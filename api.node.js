var http = require('http');
var url = require('url');
var yy = require('./yatayat.js')
var conf = require('./config.js')
var _ = require('underscore');

// fetch overpass API data
var system = {};

// split API url into host and path
var options = url.parse(conf.API_URL);
options.method='POST';
    
var req = http.request(options, function(res) {
    res.content = '';
    res.setEncoding('utf8');
    res.on('data', function(chunk) {
        //console.log('CHUNK', chunk);
        res.content += chunk;
    });
    res.on('end', function() {
        system = yy(res.content);
        console.log('got', system.routes.length, 'routes from overpass');
    });
});

req.write(conf.QUERY_STRING);
req.end();

function serializeStop(stop) {
    return {id: stop.id,
            lat: stop.lat,
            lng: stop.lng,
            name: stop.name};
}

function serializeRoute(route, isPartialRoute) {
    // returns a JSON object for a route
    var fullRouteBool = !isPartialRoute; // ie. isPartialRoute is falsy
    return {id: route.id,
            name: route.name,
            ref: route.ref,
            transport: route.transport,
            fullroute: fullRouteBool,
            stops: route.stops.map(function(s) { return serializeStop(s); })};
}

function serializeSystem(system) {
    return {routes: system.routes.map(function(r) { return serializeRoute(r); })};
}

http.createServer(function (req, res) {
    console.log('REQUEST',req.url)

    // ALWAYS A JSON RESPONSE
    res.writeHead(200, {'Content-Type': 'application/json'});

    var reqObj = url.parse(req.url, true); 
    var path = reqObj.path;
    if(! _.keys(system).length) {
        res.end("Nothing loaded yet");
    } else if (path.indexOf('routes') === 1) {
        res.end(JSON.stringify(serializeSystem(system), null, 4));
    } else if (path.indexOf('nearestStops') === 1) {
        var ll = [reqObj.query.lat, reqObj.query.lng];
        var stopArray = system.nearestStops(ll, 2);
        res.end(JSON.stringify(stopArray.map(serializeStop),
                                null, 4));
    } else if (path.indexOf('takeMeThere') === 1) {
        var routeArray = system.takeMeThere(reqObj.query.startStopID,
                                            reqObj.query.goalStopID); 
        if (!routeArray.map) { res.end("No route found"); return; }
        var ret = routeArray.map(function(r) { return serializeRoute(r,true); });
        res.end(JSON.stringify(ret, null, 4));
    } else if (path.indexOf('getAllStops') === 1) {
        res.end(JSON.stringify(_.map(system.allStops(), serializeStop), null, 4));
    } else {
        var jsonmessage = {"Access points" : [
            { path: "/routes", description: "returns all routes"},
            { path: "/nearestStops", params: ["lat", "lng"], 
                description: "nearest stops to lat/lng position"},
            { path: "/takeMeThere", params: ["startStopID", "goalStopID"],
                description: "return a list of partial routes to take when going from start to goal"},
            { path: "/getAllStops", description: "returns all stops"}]};
        res.end(JSON.stringify(jsonmessage, null, 4)); 
    }
}).listen(8020, "127.0.0.1");
console.log('yatayat api running at http://127.0.0.1:8020/');
