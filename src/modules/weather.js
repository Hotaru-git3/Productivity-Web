// src/modules/weather.js

// Ambil URL dari .env lu
const WEATHER_BASE = import.meta.env.VITE_WEATHER_API_URL;
const GEO_BASE = import.meta.env.VITE_GEO_API_URL;

// 🔥 Helper ini WAJIB ada di sini biar gak ReferenceError
const mapWmoToWeather = (code) => {
  const weatherMap = {
    0: { desc: "Cerah", icon: "fa-sun text-yellow-400" },
    1: { desc: "Cerah Berawan", icon: "fa-cloud-sun text-yellow-300" },
    2: { desc: "Berawan Partiel", icon: "fa-cloud-sun text-gray-300" },
    3: { desc: "Berawan", icon: "fa-cloud text-gray-400" },
    45: { desc: "Berkabut", icon: "fa-smog text-gray-300" },
    61: { desc: "Hujan Ringan", icon: "fa-cloud-showers-heavy text-blue-400" },
    80: { desc: "Hujan Deras", icon: "fa-cloud-showers-water text-blue-500" },
    95: { desc: "Badai Petir", icon: "fa-cloud-bolt text-indigo-500" },
  };
  return weatherMap[code] || { desc: "Berawan", icon: "fa-cloud text-gray-400" };
};

export const fetchWeatherAuto = async (lat, lon) => {
  try {
    // 1. Reverse Geocoding
    const geoRes = await fetch(`${GEO_BASE}?lat=${lat}&lon=${lon}&format=json`);
    const geoData = await geoRes.json();
    const areaName = geoData.address.city_district || geoData.address.city || geoData.address.village || "Lokasi Anda";

    // 2. Fetch Cuaca dari Open-Meteo
    const response = await fetch(`${WEATHER_BASE}?latitude=${lat}&longitude=${lon}&current_weather=true&timezone=auto`);
    
    if (!response.ok) throw new Error("Gagal ambil data cuaca");
    
    const data = await response.json();
    const current = data.current_weather;
    
    // Manggil helper yang tadi sempet error
    const weatherInfo = mapWmoToWeather(current.weathercode);

    return {
      temp: Math.round(current.temperature),
      desc: weatherInfo.desc,
      iconClass: weatherInfo.icon,
      area: areaName
    };
  } catch (error) {
    console.error("Weather Service Error:", error);
    return null;
  }
};