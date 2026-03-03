const COOKIE_NAME = 'guisogo_customer'
const EXPIRY_DAYS = 90

export function getCustomerCookie() {
    const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`))
    if (!match) { return null }
    try {
        return JSON.parse(decodeURIComponent(match[1]))
    } catch {
        return null
    }
}

export function setCustomerCookie(data) {
    const expires = new Date()
    expires.setDate(expires.getDate() + EXPIRY_DAYS)
    const value = encodeURIComponent(JSON.stringify(data))
    document.cookie = `${COOKIE_NAME}=${value}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`
}

export function generateCustomerToken() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0
        const v = c === 'x' ? r : (r & 0x3) | 0x8
        return v.toString(16)
    })
}
