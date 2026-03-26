export default  /*js*/`

                if(functionName === 'removePolyline') {
                    var sourceId = params.uniqueId + '-polylines-source';
                    var layerId = params.uniqueId + '-polylines-layout';

                    if(map.getLayer(layerId)) {
                        map.removeLayer(layerId);
                    }
                    if(map.getSource(sourceId)) {
                        map.removeSource(sourceId);
                    }
                }
            `;
