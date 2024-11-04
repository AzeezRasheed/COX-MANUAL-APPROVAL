const express = require('express');
const bodyParser = require('body-parser');
const serverless = require('serverless-http');
const { handleRunTaskRequest, handleMicrosoftResponse } = require('./approvalLogic');

const app = express();
app.use(bodyParser.json());

// Root route for testing
app.get('/', (req, res) => {
   res.send('Hello World\n');
});

// Route to handle approval requests from Terraform Cloud
app.post('/terraform-approval', async (req, res) => {
   console.log("Received request body:", JSON.stringify(req.body, null, 2));

   // Extract required fields
   const run_id = req.body.run_id || 'unknown-run-id';
   const workspace = {
      name: req.body.workspace_name || 'unknown-workspace',
      app_url: req.body.workspace_app_url || ''
   };
   const organization = req.body.organization_name || 'unknown-organization';
   const run_message = req.body.run_message || '';

   try {
      const responseMessage = await handleRunTaskRequest(run_id, workspace, organization, run_message);
      res.status(200).json({ message: responseMessage });
   } catch (error) {
      console.error("Error in terraform-approval handler:", error);
      res.status(500).json({ message: "Error sending approval request." });
   }
});

// Route to handle responses from Microsoft Teams
app.post('/microsoft-response', async (req, res) => {
   console.log("Received body in Microsoft Teams response:", req.body);

   const { action, run_id } = req.body;

   if (!action || !run_id) {
      console.error("Missing required properties in Microsoft response:", { action, run_id });
      return res.status(400).json({ error: "Invalid request: Missing required properties." });
   }

   try {
      const responseMessage = await handleMicrosoftResponse(action, run_id);
      res.status(200).send(responseMessage);
   } catch (error) {
      console.error("Error processing Microsoft response:", error.message);
      res.status(500).json({ error: "Error processing Microsoft response.", details: error.message });
   }
});

// Export the app as a Lambda handler using serverless-http
module.exports.handler = serverless(app);