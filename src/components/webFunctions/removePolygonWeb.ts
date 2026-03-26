export default  /*js*/`

if(functionName === 'removePolygon') {
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

}
`