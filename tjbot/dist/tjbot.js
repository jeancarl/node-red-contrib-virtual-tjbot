/***************************************************************************
* Copyright 2018 IBM
*
*   Virtual TJBot Nodes for Node-RED
*
*   By JeanCarl Bisson (@dothewww)
*   More info: https://ibm.biz/node-red-contrib-virtual-tjbot
*
*   Licensed under the Apache License, Version 2.0 (the "License");
*   you may not use this file except in compliance with the License.
*   You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
*   Unless required by applicable law or agreed to in writing, software
*   distributed under the License is distributed on an "AS IS" BASIS,
*   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
*   See the License for the specific language governing permissions and
*   limitations under the License.
****************************************************************************/

$(function() {
  const socket = io({path:"/tjbot/socket.io"});
  var ttsStream;
  var sttStream;

  socket.on("connect", function() {
    console.log("connected");
  });

  socket.on("error", function(err) {
    console.log("error", err);
  })        

  socket.on("config", function(config) {
    shine(config.led.color);
    switch(config.arm.position) {
      case "armBack":
        armBack();
      break;
      case "lowerArm":
        lowerArm();
      break;
      case "raiseArm":
      case "wave":
        raiseArm();
      break;
    }
  });

  socket.on("shine", function(data) {
    shine(data.color);
  });

  socket.on("pulse", function(data) {
    pulse(data.color, data.duration);
  });

  socket.on("raiseArm", raiseArm);
  socket.on("lowerArm", lowerArm);
  socket.on("armBack", armBack);            
  socket.on("wave", function(e) {
    raiseArm();
    setTimeout(lowerArm, 500);
    setTimeout(raiseArm, 1000);
  });

  socket.on("speak", speak);
  socket.on("play", play);
  socket.on("listen", listen);
  socket.on("stopListening", stopListening);
  socket.on("see", see);
  socket.on("takePhoto", takePhoto);

  function speak(msg) {
    ttsStream = WatsonSpeech.TextToSpeech.synthesize({
      text: msg.text,
      access_token: msg.token,
      voice: msg.voice
    });

    ttsStream.onended = function() {
      ttsStream = null;
      $.post({
        url: msg.callback,
        method: "POST",
        contentType: "application/json",
        data: JSON.stringify({})
      });                  
    }
  }

  function play(msg) {
    var playStream = document.getElementById("playAudio");

    playStream.setAttribute("src", msg.url);
    playStream.play();
    playStream.onended = function() {
      playStream = null;

      $.post({
        url: msg.callback,
        method: "POST",
        contentType: "application/json",
        data: JSON.stringify({})
      });                  
    }
  }

  function listen(msg) {
    // If already listening, stop this stream before we create a new one.
    if(sttStream) {
      sttStream.stop();
    }

    sttStream = WatsonSpeech.SpeechToText.recognizeMicrophone({
      access_token: msg.token,
      model: msg.model,
      object_mode: false
    });

    sttStream.on("data", function(data) {
      $.post({
        url: msg.callback,
        method: "POST",
        contentType: "application/json",
        data: JSON.stringify({
          text: data.toString()
        })
      });
    });

    sttStream.on("error", function(err) {
      throw err;
    });
  }

  function stopListening() {
    if(sttStream) {
      sttStream.stop();
    }
  }

  function see(msg) {
    _setupCamera().then(() => {
      setTimeout(function() {
        var v = document.getElementById("videoElement");
        canvas = document.getElementById("canvas");
        context = canvas.getContext("2d");
        w = canvas.width;
        h = canvas.height;

        context.drawImage(v,0,0,w,h);
        var uri = canvas.toDataURL("image/png");

        _destroyCamera();
        
        return $.post({
          url: msg.callback,
          method: "POST",
          contentType: "application/json",
          data: JSON.stringify({
            image: uri
          })
        });
      }, 200); // delay to allow video element to get image
    });
  }

  function takePhoto(msg) {
    _setupCamera().then(() => {
      setTimeout(function() {
        var v = document.getElementById("videoElement");
        canvas = document.getElementById("canvas");
        
        if(msg.width == '') {
          msg.width = 100;
        }

        if(msg.height == '') {
          msg.height = 75;
        }

        v.width = canvas.width = msg.width;
        v.height = canvas.height = msg.height;
        context = canvas.getContext("2d");
        w = canvas.width;
        h = canvas.height;
        
        context.drawImage(v,0,0,w,h);

        var uri = canvas.toDataURL("image/png");
        _destroyCamera();

        return $.post({
          url: msg.callback,
          method: "POST",
          contentType: "application/json",
          data: JSON.stringify({
            image: uri
          })
        });
      }, 200); // delay to allow video element to get image
    });
  }

  function shine(color) {
    if(color == "off") {
        color = "grey";
    }

    $("#led").css("fill", color);
  }

  function raiseArm() {
    $("#armup").show();
    $("#armdown").hide();
    $("#armback").hide();
  }

  function lowerArm() {
    $("#armup").hide();
    $("#armdown").show();
    $("#armback").hide();    
  }

  function armBack() {
    $("#armup").hide();
    $("#armdown").hide();
    $("#armback").show(); 
  }

  function pulse(color, duration) {
    $("#led").css("fill", "grey");

    const transition = (duration/2);
    $("#led").css({fill: color, transition: transition+"s"});

    setTimeout(() => {
        $("#led").css({fill: "grey", transition: transition+"s"});
    }, Math.floor(transition*1000));
  }

  function _setupCamera() {
    return new Promise((resolve, reject) => {
      var v = document.getElementById("videoElement");

      if(!v) {
        $("#cameratab").append('<video autoplay id="videoElement" width="100" height="75"></video><canvas id="canvas" width="200" height="150"></canvas>');
        
        var v = document.getElementById("videoElement");
        v.ready = false;

        if(navigator.mediaDevices.getUserMedia) {
          // get webcam feed if available
          navigator.mediaDevices.getUserMedia({video: true, audio: false}).then((stream) => {
            // if found attach feed to video element
            v.srcObject = stream;
            resolve();
          }).catch(e => {
            // no webcam found - do something
            reject(false);
          });
        } else {
          alert("browser not supported");
          reject(false);
        }
      }
    })
  }

  function _destroyCamera() {
    var stream = document.getElementById("videoElement").srcObject;
    
    if(stream) {
      stream.stop();

      $("#videoElement").remove();
      $("#canvas").remove();
    }
  }
});