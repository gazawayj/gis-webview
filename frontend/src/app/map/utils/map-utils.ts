export function formatAreaPerimeter(
    areaMeters: number,
    perimeterMeters: number
): { area: string; perimeter: string } {

    let areaStr = '';
    let perimeterStr = '';

    if (!isNaN(areaMeters) && areaMeters > 0) {
        const areaKm2 = areaMeters / 1_000_000;
        areaStr = `${areaKm2.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 4
        })} km²`;
    }
    if (!isNaN(perimeterMeters) && perimeterMeters > 0) {
        const perimeterKm = perimeterMeters / 1000;
        perimeterStr = `${perimeterKm.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })} km`;
    }
    return {
        area: areaStr,
        perimeter: perimeterStr
    };
}