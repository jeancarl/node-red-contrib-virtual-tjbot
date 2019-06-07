/***************************************************************************
* Copyright 2019 IBM
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

module.exports = function (RED) {
  const ui = require("./ui.js")(RED);

  function vtjbotNodeSee(config) {
    RED.nodes.createNode(this, config);

    const node = this;
    const bot = RED.nodes.getNode(config.botId);

    node.lastMsg = null;
    node.returnOnPayload = false;

    const SEE_CALLBACK = ui.getPath() + "/" + node.id + "/see";
    const TAKEPHOTO_CALLBACK = ui.getPath() + "/" + node.id + "/takePhoto";
    const TEMP_DIR = "/tmp/";

    RED.httpNode.post(SEE_CALLBACK, (req, res) => {
      if (req.body.error) {
        return node.error(req.body.error);
      }

      if (node.lastMsg !== null) {
        const VisualRecognitionV3 = require("ibm-watson/visual-recognition/v3");
        const fs = require("fs");

        const visual_recognition = new VisualRecognitionV3({
          version: "2018-03-19",
          url: bot.services.visual_recognition.url || VisualRecognitionV3.URL,
          iam_apikey: bot.services.visual_recognition.apikey
        });

        const image = req.body.image.replace(/^data:image\/png;base64,/, "");
        const tempFile = TEMP_DIR + Date.now() + ".png";

        fs.writeFile(tempFile, image, "base64", err => {
          const params = {
            images_file: fs.createReadStream(tempFile)
          };

          visual_recognition.classify(params)
            .then(response => {
              fs.unlinkSync(tempFile);

              var msg = node.lastMsg;
              msg.payload = response.images[0].classifiers[0].classes;

              node.send(msg);
              node.lastMsg = null;
              res.json({});
            })
            .catch(error => {
              fs.unlinkSync(tempFile);
              node.lastMsg = null;

              node.error(error.toString());
              res.sendStatus(500);
            });
        });
      } else {
        res.json({ "error": "node inactive" });
      }
    });

    RED.httpNode.post(TAKEPHOTO_CALLBACK, (req, res) => {
      if (req.body.error) {
        return node.error(req.body.error);
      }

      if (node.lastMsg !== null) {
        const tempFile = TEMP_DIR + Date.now() + ".png";
        const fs = require("fs");
        const image = req.body.image.replace(/^data:image\/png;base64,/, "");
        const msg = node.lastMsg;

        if (node.returnOnPayload) {
          msg.payload = new Buffer(image, "base64");

          node.send(msg);
          res.json({});
        } else {
          fs.writeFile(tempFile, image, "base64", err => {
            if (err) {
              node.error(err.toString());
              res.sendStatus(500);
            } else {
              msg.filename = tempFile;

              node.send(msg);
              res.json({});
            }
          });
        }

        node.lastMsg = null;
      } else {
        res.json({ "error": "node inactive" });
      }
    });

    node.on("input", function (msg) {
      if (!bot || bot.hardware.indexOf("camera") === -1) {
        return node.error("TJBot is not configured to see. Please check you enabled the camera in the TJBot configuration.");
      }

      var mode = config.mode;

      if (mode == "msg.mode") {
        mode = msg.mode;
      }

      node.lastMsg = msg;

      switch (mode.toLowerCase()) {
        case "see":
          if (!bot || !bot.services.visual_recognition || !bot.services.visual_recognition.apikey || !bot.services.visual_recognition.apikey.length) {
            return node.error("TJBot is not configured to see. Please check you included credentials for the Watson Visual Recognition service in the TJBot configuration.");
          }

          ui.emit("see", { callback: SEE_CALLBACK });
          break;
        case "takephoto":
          const width = msg.width || config.width;
          const height = msg.height || config.height;

          node.returnOnPayload = config.returnOnPayload;
          ui.emit("takePhoto", { callback: TAKEPHOTO_CALLBACK, width: width, height: height });
          break;
        default:
          node.error("No mode selected");
      }
    });

    node.on("close", function () {
      function removeRoute(path) {
        RED.httpNode._router.stack.forEach(function (route, i, routes) {
          if (route.route && route.route.path === path) {
            routes.splice(i, 1);
          }
        });
      }

      removeRoute(SEE_CALLBACK);
      removeRoute(TAKEPHOTO_CALLBACK);
    });

  };

  RED.nodes.registerType("vtjbot-see", vtjbotNodeSee);
}
