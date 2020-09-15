var nodes = [];
var isLeader = false;
var listUrl = 'ws://172.17.0.1:3020/';
var weight = 0;
var axios = require('axios');
const port = process.argv[2];
const portServer = process.argv[3];

var ipLeader = '';
const express = require('express')
const app = express()
app.use(express.json());
app.use(express.static(__dirname + '/client/'));
var cors = require('cors');
app.use(cors());
var server = require('http').Server(app);
var io = require('socket.io')(server);
var state = true;

var interval;

server.listen(portServer, function() {
    console.log("Servidor corriendo en http://localhost:3001");
});

var state = true;
var bridge;


io.on('connection', function(socket) {
    console.log('Alguien se ha conectado con Sockets');   
    bridge = socket;  
    //socket.emit('messages', 'hola');
});

//var isLeader = true;

init();
function init(){
    var WebSocketClient = require('websocket').client;
    var client = new WebSocketClient(); 
    client.on('connect', function(connection) {
        console.log('WebSocket Client Connected');
    
        connection.on('message', function(message) {
            var data = message.utf8Data.split('#');
            setNodes(data);
            console.log(nodes);
            if(nodes.length === 0){
                isLeader = true;   
            }else{
                weight = nodes.length;
                presenter();
                pingLeader();
            }
        });
        
        function sendPort() {
            if (connection.connected) {
                connection.sendUTF(port);
                //setTimeout(sendNumber, 1000);
            }
        }
        sendPort();
    });
    client.connect(listUrl, 'echo-protocol');   
}

function setNodes(data){
    for (let index = 0; index < (data.length-2); index++) {
        nodes.push(data[index]);
    }
}

app.get('/isAlive', (req, res) => {  
  res.send(isLeader);
  if(state){
    setNewLeader();
  }
  
})

app.get('/stop', (req, res) => {  
    clearInterval(interval);
    res.send(''+ weight);
})


app.get('/changeLeader/:leader', (req, res) => {
    var ip = req.params.leader
    if(ip.includes('coordinador')){
        var ipA = ip.split(':')[2];
        console.log(ipA);
        var ipReq = req.connection.remoteAddress.split(':',4)[3] + ':'+ ipA;
        ip = ipReq;
    }
    sendMessage('El nuevo lider es: ' + ip);
    verifiList(ip);
    res.send('hola');
})


function verifiList(leader){

    aux = [];
    for (let index = 0; index < nodes.length; index++) {
        if(leader !== nodes[index]){
            aux.push(nodes[index]);
        }
    }
    if(aux.length === nodes.length){
        isLeader = true;
        ipLeader = '';
        //setLeader();
    }else{
        nodes = aux;
        ipLeader = 'http://' + leader;
        pingLeader();
    }
}



app.get('/presenter/:port', (req, res) => {
    var ip = req.connection.remoteAddress.split(':',4)[3];
    var node = ip + req.params.port;
    sendMessage(node + ' Fue agregado a la lista');
    nodes.push(node);
    res.send(isLeader);
})

app.get('/amILeader', function(req, res) {
    res.send({ isLeader, state });
});

app.get('/give-up', function(req, res) {
    isLeader = false;
    state = false;
    res.send({ isLeader, state });
});



app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})


function presenter(){
    for (let index = 0; index < nodes.length; index++) {
        axios.get(nodes[index]+ '/presenter/:' + port)
          .then(function (response) {
            if(response.data){
                console.log('el lider es: ' + nodes[index]);
                ipLeader = nodes[index];
                removeLeader(ipLeader);
                console.log(nodes);
            }
          })
          .catch(function (error) {
            console.log(error);   
        });
        
    }
}

function removeLeader(leader){

    var i = nodes.indexOf( leader );
    if ( i !== -1 ) {
        nodes.splice( i, 1 );
    }
}

function pingLeader(){
    
    console.log(ipLeader);
    var time = (Math.floor(Math.random()*(10-1))+1)*1000;

    interval = setInterval(function(){
        axios.get(ipLeader+'/isAlive').then(res => {
            if(res.data){
                sendMessage('El Lider esta vivo');
            }else{
                clearInterval(interval);
                sendMessage('Se convoca una eleccion');
                stablishElection();
            }
        }).catch(function (error) {
            console.log(error);   
        });
      }, time);
}


function stablishElection(){

    ipLeader = 'coordinador';
    for (let index = 0; index < nodes.length; index++) {
        axios.get(nodes[index]+'/stop').then(res => {
            prueba(res.data,nodes[index]);
        }).catch(function (error) {
            console.log(error);   
        });   
    }

    newLeader();
}

function prueba(pesoB , node){
    var aux = weight;
    console.log('aux:'+  aux + 'pesoB:' + pesoB + 'node:'+ node );
    if(aux < pesoB){
        ipLeader = node;
        aux = pesoB;
        console.log("entrooo");
    }
    weight = aux;
}

function newLeader(){

    var ip = ipLeader;
    if(ipLeader.includes('coordinador')){
        ip = ipLeader +':'+port;
        isLeader = true;
    }
    
    for (let index = 0; index < nodes.length; index++) {
        axios.get(nodes[index]+'/changeLeader/:' + ip).then(res => {
           console.log(res.data);
        }).catch(function (error) {
            console.log(error);   
        });   
    }
}



function setNewLeader(){
    bridge.emit('leader', '');
}

function sendMessage(message){
    bridge.emit('messages', message);
}