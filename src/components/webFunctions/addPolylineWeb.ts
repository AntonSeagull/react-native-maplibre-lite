export default  /*js*/`

if(functionName === 'addPolyline') {

   

    var sourceId = params.uniqueId + '-polylines-source';
    var layerId = params.uniqueId + '-polylines-layout';

    if(map.getLayer(layerId)) {
        map.removeLayer(layerId);
    }

    if(map.getSource(sourceId)) {
        map.removeSource(sourceId);
    }

    map.addSource(sourceId, {
        'type': 'geojson',
        'data': {
            'type': 'Feature',
            'properties': {},
            'geometry': {
                'type': 'LineString',
                'coordinates': params.coordinates
            }
        }
    });

    map.addLayer({
        'id': layerId,
        'type': 'line',
        'source': sourceId,
        'layout': {
            'line-join': 'round',
            'line-cap': 'round'
        },
        'paint': {
            'line-color': params.color ?? '#000000',
            'line-width': params.width ?? 4
        }
    });

}
`