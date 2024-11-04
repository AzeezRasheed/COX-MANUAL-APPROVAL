const axios = require("axios");

// Function to check run status in Terraform Cloud
async function checkRunStatus(run_id, apiToken) {
   try {
      const response = await axios.get(`https://app.terraform.io/api/v2/runs/${run_id}`, {
         headers: { Authorization: `Bearer ${apiToken}` }
      });
      if (response.data && response.data.data && response.data.data.attributes) {
         return response.data.data.attributes.status;
      } else {
         console.warn("No valid run data returned from Terraform Cloud");
         return null;
      }
   } catch (error) {
      console.error("Error fetching run status:", error.message);
      return null; // Return null if there's an error
   }
}

// Main function to handle Run Task webhook requests
async function handleRunTaskRequest(run_id, workspace, organization, run_message) {
   const runStatus = await checkRunStatus(run_id, 'token');
   console.log(`Run ${run_id} is ${runStatus}; sending approval request.`);
   try {

      // if (!runStatus) {
      //    console.log("No valid run status available; cannot proceed with approval request.");
      //    return "Run status not available; approval request not sent.";
      // }

      // console.log("Run status:", runStatus);
      // if (runStatus === 'paused') {
         await processApprovalRequest(run_id, workspace, organization, run_message);
         return "Approval request sent to Microsoft Teams.";
      // } else {
      //    console.log(`Run ${run_id} is not paused; no approval needed.`);
      //    console.log("run status:", runStatus)
      //    return "No approval needed.";
      // }
   } catch (error) {
      console.error("Error processing Run Task:", error);
      throw new Error("Error processing Run Task.");
   }
}

// Function to send an approval request to Microsoft Teams
async function processApprovalRequest(run_id, workspace, organization, run_message) {
   const teamsPayload = {
      "@type": "MessageCard",
      "@context": "http://schema.org/extensions",
      summary: "Terraform Approval Required",
      sections: [{
         "activityTitle": `Approval Needed: ${workspace.name} in ${organization}`,
         "text": `Run ID: ${run_id}\nMessage: ${run_message}\nWorkspace URL: ${workspace.app_url}`
      }],
      potentialAction: [
         {
            "@type": "HttpPOST",
            name: "Approve",
            target: `https://p4xv4m3i4c.execute-api.us-east-1.amazonaws.com/dev/microsoft-response`,
            body: JSON.stringify({ action: "approve", run_id, workspace, organization }),
         },
         {
            "@type": "HttpPOST",
            name: "Deny",
            target: `https://p4xv4m3i4c.execute-api.us-east-1.amazonaws.com/dev/microsoft-response`,
            body: JSON.stringify({ action: "deny", run_id, workspace, organization }),
         },
      ]
   };

   try {
      console.log("Sending payload to Microsoft Teams:", JSON.stringify(teamsPayload, null, 2));
      const response = await axios.post("https://coxinc.webhook.office.com/webhookb2/microsoft-team-webhook", teamsPayload);
      console.log("Microsoft Teams response:", response.status, response.data);
   } catch (error) {
      console.error("Error sending request to Microsoft Teams:", error.toJSON ? error.toJSON() : error);
      throw new Error("Error sending approval request.");
   }
}

// Function to handle responses from Microsoft Teams
async function handleMicrosoftResponse(action, run_id) {
   const terraformUrl = `https://app.terraform.io/api/v2/runs/${run_id}/actions`;
   const headers = {
      Authorization: `Bearer token`,
      'Content-Type': 'application/vnd.api+json'
   };

   try {
      if (action === "approve") {
         console.log("Approving run:", run_id);
         const approveResponse = await axios.post(`${terraformUrl}/apply`, {}, { headers });
         console.log("Terraform approval response:", approveResponse.data);
         return "Run approved.";
      } else if (action === "deny") {
         console.log("Denying run:", run_id);
         const denyResponse = await axios.post(`${terraformUrl}/discard`, {}, { headers });
         console.log("Terraform denial response:", denyResponse.data);
         return "Run denied.";
      } else {
         throw new Error(`Invalid action received: ${action}`);
      }
   } catch (error) {
      console.error("Error processing Microsoft response:", error.message);
      throw new Error("Error processing Microsoft response.");
   }
}

module.exports = { handleRunTaskRequest, handleMicrosoftResponse };