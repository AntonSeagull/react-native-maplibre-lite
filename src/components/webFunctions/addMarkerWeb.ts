export default  /*js*/`

                if(functionName === 'addMarker') {


                    if(markers[params.uniqueId]){
                        markers[params.uniqueId].remove();
                        delete markers[params.uniqueId];
                    }


                    if(params && params.html){

                          var el = document.createElement('div');
                            el.className = 'marker';
                            el.innerHTML = params.html;

                            el.addEventListener('click', function() {
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


                if(!params || !params.iconUrl){


                    markers[params.uniqueId] = new maplibregl.Marker({
                    color: (params.color != null) ? params.color : undefined,
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


        var el2 = document.createElement('div');
        el2.className = 'marker';
        el2.style.backgroundImage = 'url(' + params.iconUrl + ')';
        el2.style.backgroundSize = 'cover';
        el2.style.backgroundPosition = 'center';
        el2.style.backgroundRepeat = 'no-repeat';
        el2.style.width = params.iconWidth + 'px';
        el2.style.height = params.iconHeight + 'px';

        el2.addEventListener('click', function() {
           window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'markerClick',
                        uniqueId: params.uniqueId
                    }));
        });

        
        markers[params.uniqueId] = new maplibregl.Marker({element: el2})
            .setLngLat([params.longitude, params.latitude])
            .addTo(map);

                    return;

                }
            }

            `;