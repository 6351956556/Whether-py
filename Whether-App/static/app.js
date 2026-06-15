/* ==========================================================================
   AeroCast Custom JS - Front-end Controller & Animation Engine
   ========================================================================= */

// --- Constants & State ---
let currentCoordinates = { lat: 23.0225, lon: 72.5714 }; // Default: Ahmedabad
let currentLocationName = "Ahmedabad, Gujarat, India";
let currentWeatherData = null;
let temperatureUnit = 'C'; // 'C' or 'F'
let debounceTimer;

// DOM Elements
const searchForm = document.getElementById('searchForm');
const searchInput = document.getElementById('searchInput');
const suggestionsList = document.getElementById('suggestionsList');
const locateBtn = document.getElementById('locateBtn');
const unitToggle = document.getElementById('unitToggle');
const unitC = document.getElementById('unitC');
const unitF = document.getElementById('unitF');
const errorBanner = document.getElementById('errorBanner');
const errorMessage = document.getElementById('errorMessage');
const closeErrorBtn = document.getElementById('closeErrorBtn');
const loader = document.getElementById('loader');
const dashboardContent = document.getElementById('dashboardContent');
const bgAnimationContainer = document.getElementById('bgAnimation');

// Weather Display Elements
const locationNameEl = document.getElementById('locationName');
const currentDateEl = document.getElementById('currentDate');
const weatherArtEl = document.getElementById('weatherArt');
const currentTempEl = document.getElementById('currentTemp');
const weatherDescEl = document.getElementById('weatherDesc');
const feelsLikeEl = document.getElementById('feelsLike');
const precipProbEl = document.getElementById('precipProb');

// Highlights Elements
const humidityValEl = document.getElementById('humidityVal');
const humidityProgressEl = document.getElementById('humidityProgress');
const windValEl = document.getElementById('windVal');
const windCompassEl = document.getElementById('windCompass');
const windDirTextEl = document.getElementById('windDirText');
const uvValEl = document.getElementById('uvVal');
const uvDescEl = document.getElementById('uvDesc');
const sunriseValEl = document.getElementById('sunriseVal');
const sunsetValEl = document.getElementById('sunsetVal');
const pressureValEl = document.getElementById('pressureVal');
const pressureDescEl = document.getElementById('pressureDesc');
const cloudValEl = document.getElementById('cloudVal');
const cloudProgressEl = document.getElementById('cloudProgress');

// Forecast Panels
const hourlyForecastContainer = document.getElementById('hourlyForecast');
const weeklyForecastContainer = document.getElementById('weeklyForecast');

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Initial Data Fetch for Default Location
    fetchWeather(currentCoordinates.lat, currentCoordinates.lon, currentLocationName);

    // 2. Setup Event Listeners
    setupEventListeners();
});

// --- Event Listeners ---
function setupEventListeners() {
    // Search input autocompletion with debounce
    searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        const query = searchInput.value.trim();
        
        if (query.length < 3) {
            suggestionsList.classList.add('hidden');
            return;
        }

        debounceTimer = setTimeout(() => {
            fetchSuggestions(query);
        }, 300);
    });

    // Close suggestions dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!searchForm.contains(e.target)) {
            suggestionsList.classList.add('hidden');
        }
    });

    // Prevent form submit from reloading page
    searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const query = searchInput.value.trim();
        if (query.length >= 3) {
            fetchSuggestions(query, true); // True to instantly select first result
        }
    });

    // Locate Me button click
    locateBtn.addEventListener('click', handleGeolocation);

    // Celsius / Fahrenheit Toggle
    unitToggle.addEventListener('change', () => {
        temperatureUnit = unitToggle.checked ? 'F' : 'C';
        
        // Update styling active classes
        if (temperatureUnit === 'F') {
            unitF.classList.add('active');
            unitC.classList.remove('active');
        } else {
            unitC.classList.add('active');
            unitF.classList.remove('active');
        }

        // Re-render UI with cached weather data
        if (currentWeatherData) {
            renderWeather(currentWeatherData);
        }
    });

    // Close Error Banner
    closeErrorBtn.addEventListener('click', () => {
        errorBanner.classList.add('hidden');
    });
}

// --- Geolocation ---
function handleGeolocation() {
    if (!navigator.geolocation) {
        showError("Geolocation is not supported by your browser.");
        return;
    }

    showLoader();
    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            currentCoordinates = { lat, lon };

            // Attempt to resolve city name via Nominatim proxy
            fetchLocationNameFromCoords(lat, lon);
        },
        (error) => {
            hideLoader();
            let msg = "Unable to retrieve your location.";
            if (error.code === error.PERMISSION_DENIED) {
                msg = "Location access denied. Please search manually.";
            }
            showError(msg);
        },
        { enableHighAccuracy: true, timeout: 10000 }
    );
}

// --- API Interactions ---

// Fetch suggestions from Flask proxy
async function fetchSuggestions(query, autoSelectFirst = false) {
    try {
        const response = await fetch(`/api/geocode?query=${encodeURIComponent(query)}`);
        if (!response.ok) throw new Error("Server error");
        
        const data = await response.json();
        const results = data.results || [];

        if (results.length === 0) {
            suggestionsList.innerHTML = '<li><span class="city-name">No locations found</span></li>';
            suggestionsList.classList.remove('hidden');
            return;
        }

        if (autoSelectFirst) {
            const first = results[0];
            const name = formatLocationName(first);
            selectLocation(first.latitude, first.longitude, name);
            return;
        }

        renderSuggestions(results);
    } catch (err) {
        console.error("Suggestions error:", err);
    }
}

// Reverse geocoding fetch to resolve coordinate to city name
async function fetchLocationNameFromCoords(lat, lon) {
    try {
        const url = `/api/reverse?latitude=${lat}&longitude=${lon}`;
        const response = await fetch(url);
        
        if (response.ok) {
            const data = await response.json();
            let name = "Current Location";
            if (data.address) {
                const city = data.address.city || data.address.town || data.address.village || data.address.suburb;
                const country = data.address.country;
                name = city ? `${city}, ${country}` : country || "Current Location";
            }
            selectLocation(lat, lon, name);
        } else {
            selectLocation(lat, lon, `Location (${lat.toFixed(2)}, ${lon.toFixed(2)})`);
        }
    } catch (err) {
        console.error("Reverse geocoding error:", err);
        selectLocation(lat, lon, `Location (${lat.toFixed(2)}, ${lon.toFixed(2)})`);
    }
}

// Fetch complete weather details from Flask proxy
async function fetchWeather(lat, lon, locationName) {
    showLoader();
    errorBanner.classList.add('hidden');

    try {
        const url = `/api/weather?latitude=${lat}&longitude=${lon}`;
        const response = await fetch(url);
        
        if (!response.ok) throw new Error("Could not retrieve weather details.");
        
        const data = await response.json();
        currentWeatherData = data;
        currentLocationName = locationName;
        currentCoordinates = { lat, lon };

        renderWeather(data);
    } catch (err) {
        console.error("Weather fetch error:", err);
        showError(err.message || "Failed to load weather data. Please try again.");
    } finally {
        hideLoader();
    }
}

// --- Render Operations ---

function renderSuggestions(results) {
    suggestionsList.innerHTML = '';
    
    results.forEach(item => {
        const li = document.createElement('li');
        const formattedName = formatLocationName(item);
        
        li.innerHTML = `
            <span class="city-name">${item.name}</span>
            <span class="city-country">${item.admin1 ? item.admin1 + ', ' : ''}${item.country}</span>
        `;
        
        li.addEventListener('click', () => {
            selectLocation(item.latitude, item.longitude, formattedName);
        });
        
        suggestionsList.appendChild(li);
    });
    
    suggestionsList.classList.remove('hidden');
}

function selectLocation(lat, lon, name) {
    suggestionsList.classList.add('hidden');
    searchInput.value = '';
    fetchWeather(lat, lon, name);
}

function formatLocationName(item) {
    const parts = [item.name];
    if (item.admin1) parts.push(item.admin1);
    if (item.country) parts.push(item.country);
    return parts.join(', ');
}

// Core weather render engine
function renderWeather(data) {
    const current = data.current;
    const daily = data.daily;
    const hourly = data.hourly;
    
    // Parse WMO Weather Code
    const weatherInfo = mapWeatherCode(current.weather_code, current.is_day);

    // 1. Update theme background
    updateBackgroundTheme(weatherInfo.theme, current.is_day);

    // 2. Main Current Weather Card details
    locationNameEl.textContent = currentLocationName;
    currentDateEl.textContent = formatCurrentDate(data.timezone);
    
    const temp = Math.round(convertTemp(current.temperature_2m));
    currentTempEl.textContent = temp;
    weatherDescEl.textContent = weatherInfo.description;
    
    // Display dynamic animated SVG icon
    weatherArtEl.innerHTML = weatherInfo.svgIcon;

    // Feels Like & Precipitation
    const apparentTemp = Math.round(convertTemp(current.apparent_temperature));
    feelsLikeEl.textContent = `${apparentTemp}°${temperatureUnit}`;
    precipProbEl.textContent = `${current.precipitation} mm`;

    // 3. Highlight Card Details
    humidityValEl.textContent = `${current.relative_humidity_2m}%`;
    humidityProgressEl.style.width = `${current.relative_humidity_2m}%`;

    // Wind status and compass direction
    const windSpeedUnit = temperatureUnit === 'C' ? 'km/h' : 'mph';
    const windSpeed = temperatureUnit === 'C' ? current.wind_speed_10m : Math.round(current.wind_speed_10m * 0.621371);
    windValEl.textContent = `${windSpeed} ${windSpeedUnit}`;
    windCompassEl.style.transform = `rotate(${current.wind_direction_10m}deg)`;
    windDirTextEl.textContent = getWindDirectionText(current.wind_direction_10m);

    // UV Index card
    const maxUvToday = daily.uv_index_max && daily.uv_index_max[0] !== undefined ? daily.uv_index_max[0] : 0;
    uvValEl.textContent = typeof maxUvToday === 'number' ? maxUvToday.toFixed(1) : maxUvToday;
    uvDescEl.textContent = getUvDescription(maxUvToday);

    // Sunrise & Sunset
    sunriseValEl.textContent = formatTimeString(daily.sunrise[0]);
    sunsetValEl.textContent = formatTimeString(daily.sunset[0]);

    // Air Pressure
    pressureValEl.textContent = `${Math.round(current.pressure_msl)} hPa`;
    pressureDescEl.textContent = getPressureDescription(current.pressure_msl);

    // Cloudiness
    cloudValEl.textContent = `${current.cloud_cover}%`;
    cloudProgressEl.style.width = `${current.cloud_cover}%`;

    // 4. Render Hourly Forecast (24 Hours)
    renderHourlyForecast(hourly, data.timezone);

    // 5. Render Weekly Forecast (7 Days)
    renderWeeklyForecast(daily);
}

// Update the body class theme and render animated background elements
function updateBackgroundTheme(theme, isDay) {
    // Determine active theme
    let activeTheme = theme;
    if (!isDay && theme === 'sunny') {
        activeTheme = 'night';
    }

    // Set body theme
    document.body.className = `theme-${activeTheme}`;

    // Generate Background Animations
    bgAnimationContainer.innerHTML = '';
    
    if (activeTheme === 'rainy') {
        const rainDiv = document.createElement('div');
        rainDiv.className = 'rain-drops';
        for (let i = 0; i < 50; i++) {
            const drop = document.createElement('div');
            drop.className = 'drop';
            drop.style.left = `${Math.random() * 100}%`;
            drop.style.animationDuration = `${0.5 + Math.random() * 0.8}s`;
            drop.style.animationDelay = `${Math.random() * 2}s`;
            rainDiv.appendChild(drop);
        }
        bgAnimationContainer.appendChild(rainDiv);
    } else if (activeTheme === 'snowy') {
        for (let i = 0; i < 40; i++) {
            const flake = document.createElement('div');
            flake.className = 'snowflake';
            flake.innerHTML = '❄';
            flake.style.left = `${Math.random() * 100}%`;
            flake.style.animationDuration = `${4 + Math.random() * 6}s`;
            flake.style.animationDelay = `${Math.random() * 5}s`;
            flake.style.fontSize = `${0.6 + Math.random() * 1}em`;
            bgAnimationContainer.appendChild(flake);
        }
    } else if (activeTheme === 'night') {
        for (let i = 0; i < 40; i++) {
            const star = document.createElement('div');
            star.className = 'star';
            star.style.left = `${Math.random() * 100}%`;
            star.style.top = `${Math.random() * 60}%`;
            const size = Math.random() * 2 + 1;
            star.style.width = `${size}px`;
            star.style.height = `${size}px`;
            star.style.animationDuration = `${2 + Math.random() * 4}s`;
            star.style.animationDelay = `${Math.random() * 3}s`;
            bgAnimationContainer.appendChild(star);
        }
    }
}

// Hourly Forecast card generator
function renderHourlyForecast(hourly, timezone) {
    hourlyForecastContainer.innerHTML = '';
    
    let targetYear, targetMonth, targetDay, nowLocalHour;
    try {
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            hour12: false
        });
        const parts = formatter.formatToParts(new Date());
        const partMap = {};
        parts.forEach(p => partMap[p.type] = p.value);
        
        targetYear = partMap.year;
        targetMonth = partMap.month;
        targetDay = partMap.day;
        nowLocalHour = parseInt(partMap.hour, 10);
    } catch (e) {
        console.warn("Timezone calculation failed, falling back to local client timezone:", e);
        const now = new Date();
        targetYear = String(now.getFullYear());
        targetMonth = String(now.getMonth() + 1).padStart(2, '0');
        targetDay = String(now.getDate()).padStart(2, '0');
        nowLocalHour = now.getHours();
    }

    const targetDateStr = `${targetYear}-${targetMonth}-${targetDay}`;
    const targetDateTimePrefix = `${targetDateStr}T${String(nowLocalHour).padStart(2, '0')}`;

    // Find starting index in hourly times matching current hour
    let startIndex = 0;
    const hourlyTimes = hourly.time || [];
    
    for (let i = 0; i < hourlyTimes.length; i++) {
        if (hourlyTimes[i].startsWith(targetDateTimePrefix)) {
            startIndex = i;
            break;
        }
    }

    // If matching hour was not found (e.g. border timezone offsets), default to first item
    if (startIndex === 0) {
        // Find nearest hour
        for (let i = 0; i < hourlyTimes.length; i++) {
            try {
                const itemDate = hourlyTimes[i].split('T')[0];
                const itemHour = parseInt(hourlyTimes[i].split('T')[1].split(':')[0], 10);
                if (itemDate === targetDateStr && itemHour >= nowLocalHour) {
                    startIndex = i;
                    break;
                }
            } catch (e) {}
        }
    }

    const maxCards = 24;
    for (let i = 0; i < maxCards; i++) {
        const idx = startIndex + i;
        if (idx >= hourlyTimes.length) break;

        const timeStr = formatHourlyTimeString(hourly.time[idx]);
        const temp = Math.round(convertTemp(hourly.temperature_2m[idx]));
        const code = hourly.weather_code[idx];
        
        // Detect day/night for hourly icons: assume 6 AM to 6 PM is day
        const hr = parseInt(hourly.time[idx].split('T')[1].split(':')[0], 10);
        const isHourlyDay = hr >= 6 && hr <= 18;
        const iconInfo = mapWeatherCode(code, isHourlyDay);

        const card = document.createElement('div');
        card.className = 'hourly-card glass-card';
        card.innerHTML = `
            <span class="time">${timeStr}</span>
            <div class="hourly-icon">${iconInfo.svgIcon}</div>
            <span class="temp">${temp}°</span>
        `;
        
        hourlyForecastContainer.appendChild(card);
    }
}

// 7-day outlook generator
function renderWeeklyForecast(daily) {
    weeklyForecastContainer.innerHTML = '';

    for (let i = 0; i < daily.time.length; i++) {
        const dateStr = daily.time[i];
        const dayName = i === 0 ? "Today" : getDayName(dateStr);
        const maxTemp = Math.round(convertTemp(daily.temperature_2m_max[i]));
        const minTemp = Math.round(convertTemp(daily.temperature_2m_min[i]));
        const code = daily.weather_code[i];
        
        // Daily forecast assume day is active
        const iconInfo = mapWeatherCode(code, true);

        // Max wind and precipitation probability
        const windMax = Math.round(daily.wind_speed_10m_max[i]);
        const rainChance = daily.precipitation_probability_max ? daily.precipitation_probability_max[i] : 0;
        const windSpeedUnit = temperatureUnit === 'C' ? 'km/h' : 'mph';
        const windSpeed = temperatureUnit === 'C' ? windMax : Math.round(windMax * 0.621371);

        const row = document.createElement('div');
        row.className = 'weekly-row';
        row.innerHTML = `
            <span class="day">${dayName}</span>
            <div class="weekly-icon">${iconInfo.svgIcon}</div>
            <div class="rain-chance">
                <i class="fa-solid fa-droplet" style="font-size: 11px; opacity: 0.8; color: #38bdf8; margin-right: 2px;"></i>
                <span style="color: var(--text-primary); margin-right: 12px;">${rainChance}%</span>
                <i class="fa-solid fa-wind" style="font-size: 11px; opacity: 0.6;"></i>
                <span>${windSpeed} ${windSpeedUnit}</span>
            </div>
            <div class="temp-range">
                <span class="temp-max">${maxTemp}°</span>
                <span class="temp-min">${minTemp}°</span>
            </div>
        `;

        weeklyForecastContainer.appendChild(row);
    }
}

// --- Helper Utilities ---

function convertTemp(celsius) {
    if (temperatureUnit === 'F') {
        return (celsius * 9 / 5) + 32;
    }
    return celsius;
}

function getWindDirectionText(degree) {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(((degree % 360) / 45)) % 8;
    return directions[index];
}

function getUvDescription(uv) {
    if (uv <= 2) return "Low risk";
    if (uv <= 5) return "Moderate risk";
    if (uv <= 7) return "High risk";
    if (uv <= 10) return "Very High risk";
    return "Extreme risk";
}

function getPressureDescription(hPa) {
    if (hPa < 1009) return "Low pressure (Stormy/Rain)";
    if (hPa <= 1020) return "Normal pressure";
    return "High pressure (Clear sky)";
}

// Format time string directly from YYYY-MM-DDTHH:MM without timezone conversions
function formatTimeString(isoString) {
    if (!isoString) return "--:--";
    try {
        const timePart = isoString.includes('T') ? isoString.split('T')[1] : isoString.split(' ')[1] || isoString;
        const parts = timePart.split(':');
        if (parts.length < 2) return timePart;
        const hour = parseInt(parts[0], 10);
        const min = parts[1];
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 || 12;
        return `${displayHour}:${min} ${ampm}`;
    } catch (e) {
        console.error("Error formatting time string:", isoString, e);
        return isoString;
    }
}

function formatHourlyTimeString(isoString) {
    if (!isoString) return "--";
    try {
        const timePart = isoString.includes('T') ? isoString.split('T')[1] : isoString.split(' ')[1] || isoString;
        const hour = parseInt(timePart.split(':')[0], 10);
        if (isNaN(hour)) return timePart;
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 || 12;
        return `${displayHour} ${ampm}`;
    } catch (e) {
        console.error("Error formatting hourly time string:", isoString, e);
        return isoString;
    }
}

function formatCurrentDate(timezone) {
    try {
        const options = { weekday: 'long', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true };
        return new Date().toLocaleString("en-US", { timeZone: timezone, ...options });
    } catch (e) {
        console.warn("Date localization failed, falling back to local format:", e);
        const options = { weekday: 'long', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true };
        return new Date().toLocaleString("en-US", options);
    }
}

function getDayName(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { weekday: 'short' });
}

function showLoader() {
    loader.classList.remove('hidden');
    dashboardContent.classList.add('loading');
}

function hideLoader() {
    loader.classList.add('hidden');
    dashboardContent.classList.remove('loading');
}

function showError(message) {
    errorMessage.textContent = message;
    errorBanner.classList.remove('hidden');
}

// --- WMO Weather Code Mapper & SVGs ---
function mapWeatherCode(code, isDay) {
    // Themes: 'sunny' (clear), 'cloudy', 'rainy', 'snowy', 'night'
    let theme = 'sunny';
    let description = 'Clear Sky';
    
    // Choose SVG template based on weather characteristics
    const svgSun = `<circle cx="50" cy="50" r="18" fill="#FBBF24" class="anim-spin" />`;
    const svgSunRays = `<g stroke="#FBBF24" stroke-width="4" stroke-linecap="round" class="anim-spin" style="transform-origin: 50px 50px;">
        <line x1="50" y1="18" x2="50" y2="8" />
        <line x1="50" y1="82" x2="50" y2="92" />
        <line x1="18" y1="50" x2="8" y2="50" />
        <line x1="82" y1="50" x2="92" y2="50" />
        <line x1="27" y1="27" x2="20" y2="20" />
        <line x1="73" y1="73" x2="80" y2="80" />
        <line x1="27" y1="73" x2="20" y2="80" />
        <line x1="73" y1="27" x2="80" y2="20" />
    </g>`;
    const svgMoon = `<path d="M45,28 A18,18 0 0,0 72,55 A22,22 0 1,1 45,28 Z" fill="#E2E8F0" />`;
    const svgCloudBack = `<path d="M25,65 Q18,65 18,58 Q18,50 26,50 Q28,35 44,35 Q58,35 60,48 Q68,48 68,58 Q68,65 60,65 Z" fill="#94A3B8" opacity="0.7" />`;
    const svgCloudFront = `<path d="M35,72 Q25,72 25,62 Q25,52 35,52 Q38,34 56,34 Q72,34 75,50 Q85,50 85,62 Q85,72 75,72 Z" fill="#E2E8F0" class="anim-bounce" />`;
    const svgRaindrop = (x, y, delay) => `<path d="M${x},${y} L${x-1},${y+10}" stroke="#38BDF8" stroke-width="2.5" stroke-linecap="round" class="anim-fall" style="animation: fall 1.5s infinite linear; animation-delay: ${delay}s;" />`;
    const svgSnowflake = (x, y, scale) => `<g transform="translate(${x}, ${y}) scale(${scale})" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round">
        <line x1="0" y1="-8" x2="0" y2="8" />
        <line x1="-8" y1="0" x2="8" y2="0" />
        <line x1="-6" y1="-6" x2="6" y2="6" />
        <line x1="-6" y1="6" x2="6" y2="-6" />
    </g>`;
    const svgLightning = `<path d="M52,48 L65,48 L48,72 L54,58 L42,58 Z" fill="#FBBF24" />`;
    const svgFogLines = `<g stroke="#94A3B8" stroke-width="3" stroke-linecap="round">
        <line x1="25" y1="52" x2="75" y2="52" />
        <line x1="18" y1="60" x2="82" y2="60" />
        <line x1="30" y1="68" x2="70" y2="68" />
    </g>`;
    
    // Set fallback default SVG icon
    let svgIcon = `<svg viewBox="0 0 100 100">${isDay ? svgSunRays + svgSun : svgMoon}</svg>`;

    // Match code to weather types
    if (code === 0) {
        // Clear sky
        if (isDay) {
            theme = 'sunny';
            description = 'Clear Sunny';
            svgIcon = `<svg viewBox="0 0 100 100">${svgSunRays}${svgSun}</svg>`;
        } else {
            theme = 'night';
            description = 'Clear Night';
            svgIcon = `<svg viewBox="0 0 100 100">${svgMoon}</svg>`;
        }
    } 
    else if (code >= 1 && code <= 3) {
        // Partly cloudy, overcast
        theme = 'cloudy';
        description = code === 1 ? 'Mainly Clear' : (code === 2 ? 'Partly Cloudy' : 'Overcast');
        
        if (isDay) {
            svgIcon = `<svg viewBox="0 0 100 100">
                <g transform="translate(-10, -10) scale(0.8)">${svgSunRays}${svgSun}</g>
                ${svgCloudFront}
            </svg>`;
        } else {
            svgIcon = `<svg viewBox="0 0 100 100">
                <g transform="translate(-10, -10) scale(0.8)">${svgMoon}</g>
                ${svgCloudFront}
            </svg>`;
        }
    } 
    else if (code === 45 || code === 48) {
        // Foggy
        theme = 'cloudy';
        description = 'Foggy';
        svgIcon = `<svg viewBox="0 0 100 100">
            ${svgCloudFront}
            ${svgFogLines}
        </svg>`;
    } 
    else if ((code >= 51 && code <= 57) || (code >= 80 && code <= 82)) {
        // Drizzle, light rain, showers
        theme = 'rainy';
        description = code >= 80 ? 'Rain Showers' : 'Drizzle';
        svgIcon = `<svg viewBox="0 0 100 100">
            ${svgCloudBack}
            ${svgCloudFront}
            <!-- Adding raindrops -->
            <path d="M38,75 L36,83" stroke="#38BDF8" stroke-width="2" stroke-linecap="round" />
            <path d="M50,78 L48,86" stroke="#38BDF8" stroke-width="2" stroke-linecap="round" />
            <path d="M62,75 L60,83" stroke="#38BDF8" stroke-width="2" stroke-linecap="round" />
        </svg>`;
    } 
    else if (code >= 61 && code <= 67) {
        // Rain
        theme = 'rainy';
        description = code >= 64 ? 'Heavy Rain' : 'Moderate Rain';
        svgIcon = `<svg viewBox="0 0 100 100">
            ${svgCloudBack}
            ${svgCloudFront}
            <!-- Multiple rain lines -->
            <path d="M38,75 L35,85" stroke="#38BDF8" stroke-width="2.5" stroke-linecap="round" />
            <path d="M48,78 L45,88" stroke="#38BDF8" stroke-width="2.5" stroke-linecap="round" />
            <path d="M58,78 L55,88" stroke="#38BDF8" stroke-width="2.5" stroke-linecap="round" />
            <path d="M68,75 L65,85" stroke="#38BDF8" stroke-width="2.5" stroke-linecap="round" />
        </svg>`;
    } 
    else if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) {
        // Snowy
        theme = 'snowy';
        description = 'Snowfall';
        svgIcon = `<svg viewBox="0 0 100 100">
            ${svgCloudBack}
            ${svgCloudFront}
            <!-- Snowflake indicators -->
            ${svgSnowflake(38, 78, 0.4)}
            ${svgSnowflake(54, 82, 0.5)}
            ${svgSnowflake(70, 78, 0.4)}
        </svg>`;
    } 
    else if (code >= 95) {
        // Stormy
        theme = 'rainy';
        description = 'Thunderstorm';
        svgIcon = `<svg viewBox="0 0 100 100">
            ${svgCloudBack}
            ${svgCloudFront}
            ${svgLightning}
        </svg>`;
    }

    return { theme, description, svgIcon };
}
