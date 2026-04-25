export interface PlaceSuggestion {
    id: string;
    placeResourceName: string;
    primaryText: string;
    secondaryText: string;
    fullText: string;
}

export interface PlaceDetails {
    latitude: number;
    longitude: number;
    address: string;
}

const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
const autocompleteEndpoint = 'https://places.googleapis.com/v1/places:autocomplete';

export const isGooglePlacesConfigured = () => Boolean(googleMapsApiKey);

export const searchPlaceSuggestions = async (
    query: string,
    sessionToken?: string,
): Promise<PlaceSuggestion[]> => {
    if (!googleMapsApiKey || query.trim().length < 3) {
        return [];
    }

    const response = await fetch(autocompleteEndpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': googleMapsApiKey,
            'X-Goog-FieldMask':
                'suggestions.placePrediction.place,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat',
        },
        body: JSON.stringify({
            input: query.trim(),
            languageCode: 'en',
            regionCode: 'IN',
            ...(sessionToken ? { sessionToken } : {}),
        }),
    });

    if (!response.ok) {
        throw new Error(`Places autocomplete failed with status ${response.status}`);
    }

    const data = await response.json();
    const suggestions = Array.isArray(data?.suggestions) ? data.suggestions : [];

    return suggestions
        .map((item: any, index: number): PlaceSuggestion | null => {
            const prediction = item?.placePrediction;
            if (!prediction?.place) {
                return null;
            }

            return {
                id: `${prediction.place}-${index}`,
                placeResourceName: prediction.place,
                primaryText:
                    prediction?.structuredFormat?.mainText?.text ||
                    prediction?.text?.text ||
                    'Unknown place',
                secondaryText:
                    prediction?.structuredFormat?.secondaryText?.text || '',
                fullText:
                    prediction?.text?.text ||
                    [
                        prediction?.structuredFormat?.mainText?.text,
                        prediction?.structuredFormat?.secondaryText?.text,
                    ]
                        .filter(Boolean)
                        .join(', '),
            };
        })
        .filter(Boolean) as PlaceSuggestion[];
};

export const fetchPlaceDetails = async (
    placeResourceName: string,
    sessionToken?: string,
): Promise<PlaceDetails> => {
    if (!googleMapsApiKey) {
        throw new Error('Google Maps API key is not configured');
    }

    const response = await fetch(`https://places.googleapis.com/v1/${placeResourceName}`, {
        method: 'GET',
        headers: {
            'X-Goog-Api-Key': googleMapsApiKey,
            'X-Goog-FieldMask': 'displayName,formattedAddress,location',
            ...(sessionToken ? { 'X-Goog-Session-Token': sessionToken } : {}),
        },
    });

    if (!response.ok) {
        throw new Error(`Place details failed with status ${response.status}`);
    }

    const data = await response.json();

    return {
        latitude: data?.location?.latitude,
        longitude: data?.location?.longitude,
        address: data?.formattedAddress || data?.displayName?.text || 'Unknown location',
    };
};
