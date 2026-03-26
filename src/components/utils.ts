import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_VERSION = 'v1';

export const loadResources = async (url: string) => {
    const cacheKey = `${url}@${CACHE_VERSION}`;

    try {
        const stored = await AsyncStorage.getItem(cacheKey);
        if (stored) {
            return stored;
        }
    } catch (_) {
        // cache miss — proceed to fetch
    }

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to load resource: ${url} (${response.status})`);
    }
    const text = await response.text();

    if (text) {
        try {
            await AsyncStorage.setItem(cacheKey, text);
        } catch (_) {
            // storage full or unavailable — non-fatal
        }
    }
    return text;
}