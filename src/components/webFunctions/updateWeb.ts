export default /*js*/`

  function centersAreEqual(a, b, epsilon = 1e-6) {
    return (
      Math.abs(a.lng - b[0]) < epsilon &&
      Math.abs(a.lat - b[1]) < epsilon
    );
  }

  if(functionName === 'update') {

    /*  if(params && params.center) {
          var newCenter = params.center;
          var currentCenter = map.getCenter();

          if (!centersAreEqual(currentCenter, newCenter)) {
              map.setCenter(newCenter);
          }
      }

      if(params && params.zoom != null) {
          var newZoom = params.zoom;
          var currentZoom = map.getZoom();

          if(currentZoom !== newZoom) {
              map.setZoom(newZoom);
          }
      }*/

      if(params && params.minZoom != null) {
          var newMinZoom = params.minZoom;
          var currentMinZoom = map.getMinZoom();

          if(currentMinZoom !== newMinZoom) {
              map.setMinZoom(newMinZoom);
          }
      }

      if(params && params.maxZoom != null) {
          var newMaxZoom = params.maxZoom;
          var currentMaxZoom = map.getMaxZoom();

          if(currentMaxZoom !== newMaxZoom) {
              map.setMaxZoom(newMaxZoom);
          }
      }

      if(params && params.zoomEnabled != null) {
          if(params.zoomEnabled) {
              map.doubleClickZoom.enable();
              map.touchZoomRotate.enable();
              map.dragRotate.enable();
          } else {
              map.doubleClickZoom.disable();
              map.touchZoomRotate.disable();
              map.dragRotate.disable();
          }
      }

      if(params && params.scrollEnabled != null) {
          if(params.scrollEnabled) {
              map.scrollZoom.enable();
              map.dragPan.enable();
          } else {
              map.scrollZoom.disable();
              map.dragPan.disable();
          }
      }

      if(params && params.mapStyle) {
          map.setStyle(params.mapStyle);
      }

  }
`;