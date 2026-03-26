export default  /*js*/`
    if(functionName === 'fitBounds') {

        var padding = (params && params.padding) ? params.padding : 40;
        var duration = (params && params.duration) ? params.duration : 500;

        map.fitBounds(params.bounds, {
            padding: padding,
            duration: duration
        });
    }
`;