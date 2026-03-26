export default  /*js*/`

  if(functionName === 'init') {

            function simplifyStyle(mapInstance, aggressive){
              if(!mapInstance) return;
              var style = mapInstance.getStyle();
              var layers = style && style.layers ? style.layers : [];
              for(var i = 0; i < layers.length; i++){
                var layer = layers[i];
                var layerId = layer.id;
                var layerType = layer.type;
                var shouldHide = false;

                if(layerType === 'symbol' || layerType === 'fill-extrusion' || layerType === 'hillshade'){
                  shouldHide = true;
                }

                if(aggressive && (layerType === 'line' || layerType === 'circle')){
                  var layerIdLower = String(layerId || '').toLowerCase();
                  if(
                    layerIdLower.indexOf('road-label') !== -1 ||
                    layerIdLower.indexOf('poi') !== -1 ||
                    layerIdLower.indexOf('label') !== -1 ||
                    layerIdLower.indexOf('boundary') !== -1 ||
                    layerIdLower.indexOf('admin') !== -1
                  ){
                    shouldHide = true;
                  }
                }

                if(shouldHide){
                  try{
                    mapInstance.setLayoutProperty(layerId, 'visibility', 'none');
                  } catch (_) {}
                }
              }
            }

            function setOverlayLayersVisibility(mapInstance, visibility){
              if(!mapInstance) return;
              var style = mapInstance.getStyle();
              var layers = style && style.layers ? style.layers : [];
              for(var i = 0; i < layers.length; i++){
                var layer = layers[i];
                var layerId = String(layer.id || '');
                var isCustomOverlay =
                  layerId.indexOf('-polylines-layout') !== -1 ||
                  layerId.indexOf('-polygons-fill') !== -1 ||
                  layerId.indexOf('-polygons-stroke') !== -1;

                if(isCustomOverlay){
                  try{
                    mapInstance.setLayoutProperty(layerId, 'visibility', visibility);
                  } catch (_) {}
                }
              }
            }


             map = new maplibregl.Map({
            container: 'map',
            style: params.style,
              //Moscow coordinates
              center: params.center, // starting position [lng, lat]
              zoom: params.zoom, // starting zoom


              // общий выключатель
              zoomControl: params.zoomEnabled,
              // точнее
              scrollZoom: params.scrollEnabled,   // колесо мыши / трекпад
              doubleClickZoom: params.zoomEnabled,
              touchZoomRotate: params.zoomEnabled,
              minZoom: params.minZoom,
            maxZoom: params.maxZoom,
            dragPan: params.scrollEnabled,   // запрет перетаскивания
              dragRotate: params.zoomEnabled,
              antialias: params.antialias ?? false,
              crossSourceCollisions: params.crossSourceCollisions ?? true,
              fadeDuration: params.fadeDuration ?? 120,
              pixelRatio: params.pixelRatio,
              renderWorldCopies: params.renderWorldCopies ?? true
              });

              if (typeof params.maxPitch === 'number') {
                map.setMaxPitch(params.maxPitch);
              }

              if (params.maxPitch === 0) {
                map.dragRotate.disable();
                map.touchZoomRotate.disableRotation();
              }



                function getEventParams(){
                    if(!map) return {
                        center: null,
                        zoom: null
                    }
                    var center = map.getCenter(); 
                    var zoom = map.getZoom();


                    return {
                        center,
                        zoom
                    }
                }
                            
              //movestart moveend
              map.on("movestart",(event)=>{
                if(params.turboWhileMoving){
                  setOverlayLayersVisibility(map, 'none');
                }
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'event', event: 'movestart', params: getEventParams() }));
              })
              map.on("moveend",(event)=>{
                if(params.turboWhileMoving){
                  setOverlayLayersVisibility(map, 'visible');
                }
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'event', event: 'moveend', params: getEventParams() }));
              })
              /*zoomstart zoomend*/
              map.on("zoomstart",(event)=>{
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'event', event: 'zoomstart', params: getEventParams() }));
              })
              map.on("zoomend",(event)=>{
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'event', event: 'zoomend', params: getEventParams() }));
              })
            

              map.on("idle",(event)=>{
                  window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'event', event: 'idle', params: getEventParams() }));
              })
           
          
           


              map.on('load', function () {
                if(params.simplifyStyle){
                  simplifyStyle(map, Boolean(params.aggressiveSimplifyStyle));
                }
            
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'inited' }));
              });


               
}
`