import axios from 'axios'

const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost',
    headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Restaurant-Token': import.meta.env.VITE_RESTAURANT_TOKEN || '',
    },
})

export default api
