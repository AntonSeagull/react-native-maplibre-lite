export default  /*js*/`

                if(functionName === 'addMarker') {

                  
                    if(markers[params.uniqueId]){
                        markers[params.uniqueId].remove();
                        delete markers[params.uniqueId];
                    }


                if(!params?.iconUrl){


                    markers[params.uniqueId] = new maplibregl.Marker({
                    color: params.color ?? undefined,
                }).setLngLat([params.longitude, params.latitude])
                .addTo(map);
                markers[params.uniqueId].getElement().addEventListener('click', function() {
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'markerClick',
                        uniqueId: params.uniqueId
                    }));
                });

                return;

        }else{


        const el = document.createElement('div');
        el.className = 'marker';
        el.style.backgroundImage = 'url(' + params.iconUrl + ')';
        el.style.width = params.iconWidth + 'px';
        el.style.height = params.iconHeight + 'px';

        el.addEventListener('click', () => {
           window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'markerClick',
                        uniqueId: params.uniqueId
                    }));
        });

        
        markers[params.uniqueId] = new maplibregl.Marker({element: el})
            .setLngLat([params.longitude, params.latitude])
            .addTo(map);

                    return;

                }
            }

            `;