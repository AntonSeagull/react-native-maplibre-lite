export default  /*js*/`

                if(functionName === 'removeMarker') {
                    if(markers[params.uniqueId]){
                        markers[params.uniqueId].remove();
                        delete markers[params.uniqueId];
                    }
                }
            `