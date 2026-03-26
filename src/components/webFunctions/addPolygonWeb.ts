export default  /*js*/`

if(functionName === 'addPolygon') {

    var sourceId = params.uniqueId + '-polygons-source';
    var fillLayerId = params.uniqueId + '-polygons-fill';
    var strokeLayerId = params.uniqueId + '-polygons-stroke';

    if(map.getLayer(strokeLayerId)) {
        map.removeLayer(strokeLayerId);
    }
    if(map.getLayer(fillLayerId)) {
        map.removeLayer(fillLayerId);
    }
    if(map.getSource(sourceId)) {
        map.removeSource(sourceId);
    }

    map.addSource(sourceId, {
        'type': 'geojson',
        'data': {
            'type': 'Feature',
            'geometry': {
                'type': 'Polygon',
                'coordinates': [params.coordinates]
            }
        }
    });

    var fillPaint = {};
    fillPaint['fill-color'] = params.fillColor || 'rgba(0,0,0,0)';
    if(params.fillOpacity != null) fillPaint['fill-opacity'] = params.fillOpacity;
    if(params.strokeColor) fillPaint['fill-outline-color'] = params.strokeColor;

    map.addLayer({
        'id': fillLayerId,
        'type': 'fill',
        'source': sourceId,
        'layout': {},
        'paint': fillPaint
    });

    if(params.strokeColor || params.strokeWidth) {
        var linePaint = {};
        if(params.strokeColor) linePaint['line-color'] = params.strokeColor;
        if(params.strokeOpacity != null) linePaint['line-opacity'] = params.strokeOpacity;
        if(params.strokeWidth != null) linePaint['line-width'] = params.strokeWidth;

        map.addLayer({
            'id': strokeLayerId,
            'type': 'line',
            'source': sourceId,
            'layout': {},
            'paint': linePaint
        });
    }

}
`