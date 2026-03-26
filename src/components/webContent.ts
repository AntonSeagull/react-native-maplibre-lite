import type {SourcesProps} from './types';
import {loadResources} from './utils';

export const maplibreHtmlMap = async (webFunctions: string, sources: SourcesProps, debugMode: boolean) => {
    //Загружаем скрипты как текст


    let maplibreJS = await loadResources(sources.maplibreJS);
    let maplibreCSS = await loadResources(sources.maplibreCSS);
    let pmtiles = await loadResources(sources.pmtilesJS);

    console.log('MapLibre: maplibreJS', !!maplibreJS ? 'true' : 'false');
    console.log('MapLibre: maplibreCSS', !!maplibreCSS ? 'true' : 'false');
    console.log('MapLibre: pmtiles', !!pmtiles ? 'true' : 'false');



    return `<!DOCTYPE html>
<html lang="">

<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title></title>

   
    <script>${maplibreJS}</script>
    
    <style>${maplibreCSS}</style>


    <script>${pmtiles}</script>

    <style>


    html,
    body {
    
        overflow: hidden;
        height: 100vh;
        width: 100vw;
        margin: 0;
        padding: 0;

    }



    * {
        -webkit-user-select: none;
        -khtml-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
        user-select: none;
    }


    * {
        -webkit-touch-callout: none;
        -moz-touch-callout: none;
        -ms-touch-callout: none;
        touch-callout: none;
    }

    * {
        -webkit-user-drag: none;
        -moz-user-drag: none;
        -ms-user-drag: none;
        user-drag: none;
    }

    .maplibregl-ctrl-bottom-right {
        display: none;
    }


     #map {
   
  
        height: 100vh;
        width: 100vw;
    }
</style>

</head>

<body>
    <div id="map"></div>
</body>

<script>

var markers = {};
var polylines = {};
var polygons = {};
var rectangles = {};
var layouts = {};

var map = null;

try {
    var protocol = new pmtiles.Protocol();
    maplibregl.addProtocol("pmtiles", protocol.tile);

  window.onload = function () {
        document.addEventListener("message", function (event) {
            receiveMessage(event.data);
        });
        window.addEventListener("message", function (event) {
            receiveMessage(event.data);
        });
         if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'scriptReady' }));
        }
    }


  function receiveMessage(message) {

      var data = JSON.parse(message);

      var functionName = data.function;
      var params = data.params;







      try{

${webFunctions}

} catch (e) {
    if(${debugMode}){
        alert('WebView function error: ' + functionName + ' ' + e.message);
    }
    console.error('WebView function error:', functionName, e.message);
    window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'error',
        data: {
            target: functionName,
            message: String(e.message),
        }
    }));
}
    };

} catch (e) {

    if(${debugMode}){
        alert('pmtiles init error: ' + e.message);
    }

  
}
</script>


</html>`;
};
