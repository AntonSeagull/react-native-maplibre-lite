import AsyncStorage from '@react-native-async-storage/async-storage';

import type { SourcesProps } from './components/types';

const CACHE_VERSION = 'v1';

const loadResources = async (url: string) => {
    const cacheKey = `${url}@${CACHE_VERSION}`;

    try {
        const stored = await AsyncStorage.getItem(cacheKey);
        if (stored) {
            return stored;
        }
    } catch (_) {
        // cache miss — proceed to fetch
    }

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to load resource: ${url} (${response.status})`);
    }
    const text = await response.text();

    if (text) {
        try {
            await AsyncStorage.setItem(cacheKey, text);
        } catch (_) {
            // storage full or unavailable — non-fatal
        }
    }
    return text;
}

export const maplibreHtmlMap = async (webFunctions: string, sources: SourcesProps) => {
    //Загружаем скрипты как текст


    let maplibreJS = await loadResources(sources.maplibreJS);
    let maplibreCSS = await loadResources(sources.maplibreCSS);
    let pmtiles = await loadResources(sources.pmtilesJS);



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
    let protocol = new pmtiles.Protocol();
    maplibregl.addProtocol("pmtiles", protocol.tile);
} catch (e) {
    console.error('pmtiles init error:', e.message);
}
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


  const receiveMessage = (message) => {

      var data = JSON.parse(message);

      var functionName = data.function;
      var params = data.params;







      try{

${webFunctions}

} catch (e) {
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


</script>


</html>`;
};
