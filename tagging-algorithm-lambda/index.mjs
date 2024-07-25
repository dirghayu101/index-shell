/* 
                        Tagging Algorithm Enigma

Performs tagging of received snippet and also generate a summary. This will be same for the same snippet.

So let's say even if multiple user enters "docker ps", it will return the same output, so for an efficient use, let's create a common database for such commands shared between all the users.

What about commands with sensitive information? In later version we can extend and support that, but currently sensitive commands should not be shared.

So, user will also have a DB of snippets overlapping. When user performs a search, we will first search it in their private DB, following this in the main snippet commonly shared database.

There should be one endpoint, that resolve this search. A lambda function that will run search on both snippet and user's custom snippet database, and return response.

TaggingAlgorithmEnigma.js endpoint will resolve snippet POST request for Index Shell. 

The input will be command (mandatory), tag-array (optional) and summary (optional). 

Processing involves, first creating an object to be inserted in the Snippet DB. This object has key-value pairs of: command, tag-array and summary.

After insertion of this object in the Snippet DB, if the user had provided the optional options of either tag-array or summary, those values will be inserted in the User's snippet sub-DB, with ID overlapping. 

So, for this insertion a new snippet object with the same ID but custom tag-array and summary value will be posted in the user database.

At this phase, the snippet DB and user DB have no relation with each other. They exist independently and do their own thing. This reduces complexity.

If a user wants to perform a search, we will first perform the search in the user's sub snippet database, then in the main table. 

# Considerations:
    - Tags will be copied to user DB and if there will be custom tags added by user, they will be pushed at the top of the tag array.

    - If user doesn't provide any custom summary, the generated summary will override it.

    - Snippet will be copied as it is.

    - Snippet table is the immutable single source of truth.

# Possible corner cases: 
    - command snippet formatting eg ls -al & ls -la have the same functionality but will be treated as two different snippets. 
    - Snippet with some values like: aws configure --profile somePersonalProfile

    What if there is already an entry? -> Put a check for this.

# Assumption:
    - Snippet and SnippetID are immutable once inserted in either DB.
    - A snippet can only be inserted in the UserModel Database only after it has been inserted in the SnippetModel database.

# Validations for the received command:
    - Frontend 'text value required'
    - Backend 'LLM check'
    - Exist check.

# This method use cases:
    - User made a post request for inserting a new command. tag-array or summary has been provided. No copy in user and snippet model.
    - User made a post request for inserting a new command. tag-array or summary has not been provided. No copy in user and snippet model.
    - User made a post request for inserting a new command. But the command only exist in the snippet model. So, a copy will be made in the user model.
    - User made a post request for inserting a new command. The command  exist in both the snippet and the user model. tag-array or summary has been provided -> so these will be updated.
    - User made a post request for inserting a new command. The command  exist in both the snippet and the user model. tag-array or summary has not been provided -> so nothing happens.
 

- Dirghayu Joshi
*/

import { randomBytes } from "crypto";
import AWS from "aws-sdk";
import { SnippetModel } from "./SnippetModel.mjs";
import { UserModel } from "./UserModel.mjs";
import { GenerateSnippet } from "./gemini.mjs";

const dynamoDB = new AWS.DynamoDB.DocumentClient();

let responseMessage = "Snippet duplicate already exist in the database.";

export const handler = async (event, context, callback) => {
  // NOTE: Removed for testing tagging algorithm now.
  if (!event.requestContext.authorizer) {
    errorResponse(
      "Authorization not configured",
      context.awsRequestId,
      callback
    );
    return;
  }
  // Because we're using a Cognito User Pools authorizer, all of the claims
  // included in the authentication token are provided in the request context.
  // This includes the username as well as other attributes.
  const email = event.requestContext.authorizer.claims["cognito:email"];

  // The body field of the event in a proxy integration is a raw string.
  // In order to extract meaningful values, we need to first parse this string
  // into an object. A more robust implementation might inspect the Content-Type
  // header first and use a different parsing strategy based on that value.
  const requestBody = JSON.parse(event?.body);
  // NOTE
  console.log("Received Request Body: ", requestBody);

  if (!requestBody.command) {
    // NOTE
    console.error("Validation error. Request body not found.");
    errorResponse("Invalid Values Received", context.awsRequestId, callback);
    return;
  }

  let receivedCommand = requestBody?.command;
  const receivedSummary = requestBody?.summary || "";
  const receivedTagArray = requestBody?.tagArray || [];
  let generatedSummary = "",
    generatedTagArray = [];

  // NOTE
  console.log("The received command is: ", receivedCommand);

 
  try {
    // Scans only the snippet table. Snippet table is the immutable single source of truth.
    let snippetValue = await checkIfSnippetExists(receivedCommand);
    let snippetId = undefined;
    if(snippetValue){
      // Storing these values because snippet value exist in the snippet database but might not in the user database.
      ({
        snippetId,
        tagArray: generatedTagArray,
        summary: generatedSummary,
      } = snippetValue);
    }else {
      // Case: Snippet doesn't exist.
      // retrieval-augmented generation (RAG)
      responseMessage = "Snippet copy doesn't exist in the database.";
      snippetId = toUrlString(randomBytes(16));
      // Destructuring the received object and storing their values in already declared values.
      const genSnipObj = await GenerateSnippet(receivedCommand);
      if (genSnipObj) {
        ({
          "tag-array": generatedTagArray,
          "formatted-command": receivedCommand,
          summary: generatedSummary,
        } = genSnipObj);
      }

      await createSnippet(
        snippetId,
        receivedCommand,
        generatedSummary,
        generatedTagArray
      );

      responseMessage = responseMessage.concat(
        "Snippet processed and added to database successfully."
      );
    } 

    // At this point. Snippet should exist regardless. 
    // The snippet 
    // Case: When user doesn't enter any custom summary or tags.

    const userModelSummary = receivedSummary || generatedSummary;

    // NOTE: Error prone: 
    const userModelTagArray = Array.isArray(generatedTagArray) 
    ? generatedTagArray.concat(receivedTagArray) 
    : console.error("Generated tag array is invalid.", generatedTagArray, "Received tag array value:", receivedTagArray);
    
   
    // Old snippet doesn't matter.
    let snippetData = new SnippetModel(
      snippetId,
      receivedCommand,
      userModelSummary,
      userModelTagArray
    );
    console.log("Snippet data that is going to be pushed into the user model is: ", typeof snippetData)

    let user = await checkIfUserExists(email);

    if (!user) {
      responseMessage = responseMessage.concat(
        "User doesn't exist in the DB, creating user."
      );
      await createUser(email);
      responseMessage = responseMessage.concat("User created.");
      user = new UserModel(email, [snippetData]);
      //  NOTE: Possible breakage.
      console.log("After user creation, the user will be: ", user);
    } 
    
    // This block will be executed if the user already exist in the database.
    else {
      // NOTE: Possible breakage.
      console.log("User's snippet array value currently: ", user.snippetArray, "The type of this value is: ", typeof user.snippetArray)
      console.log("After object.values method: ", Object.values(user.snippetArray));
      const tempUserObjStore = user.snippetArray.map(obj => obj.snippetId) 
      console.log("The value of user snippet array modified is: ", tempUserObjStore);
      user = new UserModel(user.email, tempUserObjStore)
      // Check if user has a copy of received command.
      const checkIfSnippetExistsUser = user?.snippetArray.some(
        (snippet) => snippet.snippetId === snippetId
      );

      console.log(
        "checkIfSnippetExistsUser will check if the snippet ID received from the snippet table command matches with any snippet ID in the user table. Value of checkIfSnippetExistUser: ",
        checkIfSnippetExistsUser
      );

      if (checkIfSnippetExistsUser) {
        // Case: Snippet already exist in the user model.
        console.log("Case: Snippet already exist in the user model.");
        responseMessage = responseMessage.concat(
          "Snippet copy already exist in the user database."
        );
        user = updateSnippetUserModel(
          receivedCommand,
          snippetId,
          receivedTagArray,
          receivedSummary,
          user
        );
      } else {
        console.log("Case: Snippet doesn't exist in the user model.");
        responseMessage = responseMessage.concat(
          "Snippet doesn't exist local to user. Creating a copy."
        );
        user.snippetArray.push(snippetData);
      }
    }
    await updateUser(user);
    responseMessage = responseMessage.concat("Updated user successfully!");
    callback(null, {
      statusCode: 201,
      body: JSON.stringify({
        message: responseMessage,
        snippetId: snippetId,
        snippetData,
      }),
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("An error occurred: ", error);
    errorResponse("Main handler error.", context.awsRequestId, callback);
    return;
  }
};

// NOTE: Possible breakage point.
// Working.
const updateSnippetUserModel = (
  command,
  snippetId,
  tagArray,
  summary,
  user
) => {
  console.log("The value of user in updateSnippetUserModel is: ", user);
  const snippetIndex = user.snippetArray.findIndex(
    (snippet) => snippet.snippetId === snippetId
  );
  // Append new tags to the existing tag array.
  user.snippetArray[snippetIndex].tagArray = [
    ...new Set([...user.snippetArray[snippetIndex].tagArray, ...tagArray]),
  ];

  user.snippetArray[snippetIndex].command = command;
  // Override the summary value.
  user.snippetArray[snippetIndex].summary = summary;
  console.log("After invoking updateSnippetUserModel method, user is:", user);
  return user;
};

// Working!
const checkIfSnippetExists = async (command) => {
  // Checks in Snippet model.
  const params = {
    TableName: "Snippet",
    FilterExpression: "command = :command",
    ExpressionAttributeValues: { ":command": command },
  };
  try {
    const {Items} = await dynamoDB.scan(params).promise();
    // Returns snippetId if snippet exists, null otherwise.
    return Items[0]|| null;
  } catch (error) {
    console.error(`Error checking snippet existence: ${error.message}`);
    return null;
    // throw new Error('Error checking snippet existence');
  }
};


// Working!
const updateUser = async (user) => {
  // NOTE: Breaking.
  let {snippetArray: modSnipArr} = user.toItem();
  console.log("The modSnipArray that is going to be updated in the user table is: ", modSnipArr)
  const params = {
    TableName: "User",
    Key: { email: user.email },
    UpdateExpression: "SET snippetArray = :sa",
    ExpressionAttributeValues: {
      ":sa": modSnipArr,
    },
  };
  try {
    console.log("Invoking updateUser method.");
    const result = await dynamoDB.update(params).promise();
    console.log("result of updateUser: ", result);
    return;
  } catch (error) {
    console.error(`Error updating user: ${error.message}`);
    throw new Error("Error updating user");
  }
};

const checkIfUserExists = async (email) => {
  const params = {
    TableName: "User",
    Key: { email },
  };

  try {
    console.log("Invoking checkIfUserExists method.");
    const { Item: result } = await dynamoDB.get(params).promise();
    console.log("Result of checkIfUserExists function: ", result);
    return result ? result : null; // Returns user if user exists.
  } catch (error) {
    console.error(`Error checking user existence: ${error.message}`);
    return null;
    // throw new Error('Error checking user existence');
  }
};

// Working.
const createUser = async (email) => {
  try {
    const userModel = new UserModel(email);
    const params = {
      TableName: "User",
      Item: userModel.toItem(),
    };
    console.log("Invoking createUser method.");
    const result = await dynamoDB.put(params).promise();
    return 1;
  } catch (error) {
    console.error(`Error creating user: ${error.message}`);
    throw new Error("Error creating user");
  }
};

// Working!
const createSnippet = async (snippetId, command, summary, tagArray) => {
  try {
    const dataModel = new SnippetModel(snippetId, command, summary, tagArray);
    const params = {
      TableName: "Snippet",
      Item: dataModel.toItem(),
    };
    console.log("Invoking createSnippet method.");
    await dynamoDB.put(params).promise();
    return 1;
  } catch (error) {
    console.error(`Error creating item: ${error.message}`);
    throw new Error("Error creating item");
  }
};

function errorResponse(errorMessage, awsRequestId, callback) {
  callback(null, {
    statusCode: 500,
    body: JSON.stringify({
      Error: errorMessage,
      Reference: awsRequestId,
    }),
    headers: {
      "Access-Control-Allow-Origin": "*",
    },
  });
}

function toUrlString(buffer) {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}
