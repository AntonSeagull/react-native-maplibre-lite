export const flyToWeb = /*js*/`
    if(functionName === 'flyTo') {

        var duration = (params && params.duration) ? params.duration : 500;
        map.flyTo({
            center: params.center,
            zoom: params.zoom,
            duration: duration
        });
    }
`;