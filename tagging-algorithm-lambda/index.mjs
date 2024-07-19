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

import { randomBytes } from 'crypto';
import AWS from 'aws-sdk';
import { SnippetModel } from './SnippetModel.mjs';
import { UserModel } from './UserModel.mjs';
import { GenerateSnippet } from './gemini.mjs';
import Joi from 'joi';

const dynamoDB = new AWS.DynamoDB.DocumentClient();
const validationSchema = Joi.object({
  command: Joi.string().required(),
  summary: Joi.string(),
  tagArray: Joi.array().items(Joi.string()),
})


export const handler = async (event, context, callback) => {
  if (!event.requestContext.authorizer) {
    errorResponse(
      "Authorization not configured",
      context.awsRequestId,
      callback
    );
    return;
  }
  const snippetId = toUrlString(randomBytes(16));


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
 
  // Validation for the received command.
  const {error} = validationSchema.validate({...requestBody})
  if(error){
    // NOTE
    console.error("Validation error: ", error);
    errorResponse(
      "Invalid Values Received",
      context.awsRequestId,
      callback
    );
    return;
  }



  const receivedCommand = requestBody?.command;
  const receivedSummary = requestBody?.summary || "";
  const receivedTagArray = requestBody?.tagArray || [];
  let generatedCommand = "",
    generatedSummary = "";
  let generatedTagArray = [];
  
  // NOTE
  console.log("The received command is: ", receivedCommand);

  // What if command already exist in the Snippet database?
  // If there will be any tag value or summary value sent along with command, those will be inserted in the user model along with command, if there already is a definition in the user model as well, then just override it with the latest received definition of summary, and append new tag values at the top of the array.

  try {
    let snippetKey = await checkIfSnippetExists(receivedCommand);
    if (!snippetKey) {
      // Case: Snippet doesn't exist.
      // retrieval-augmented generation (RAG)
      snippetKey = snippetId;

      //   Destructuring the received object.
      // NOTE: Error prone.
      const {
        "tag-array": generatedTagArray,
        "formatted-command": generatedCommand,
        summary: generatedSummary,
      } = await GenerateSnippet(receivedCommand);
      
      await createSnippet(
        snippetId,
        generatedCommand,
        generatedSummary,
        generatedTagArray
      );
    }

    // At this point. Snippet should exist regardless. We only have to worry about User Model here.
    // Case: When user doesn't enter any custom summary or tags.

    const userModelSummary = receivedSummary || generatedSummary;
    const userModelTagArray = (generatedTagArray).concat(receivedTagArray);

    const snippetData = new SnippetModel(
      snippetKey,
      receivedCommand,
      userModelSummary,
      userModelTagArray
    );

    let user = await checkIfUserExists(email);
    if (!user) {
      await createUser(email);
      user = new UserModel(email, [snippetData])
    }
    

// snippet.snippetId === snippetKey

    const checkIfSnippetExistsUser =  user?.snippetArray.some((snippet) => snippet.snippetId === snippetKey);

    console.log("Value of checkIfSnippetExistUser variable: ", checkIfSnippetExistsUser)
    if (checkIfSnippetExistsUser) {
      // Case: Snippet already exist in the user model.
      console.log("Case: Snippet already exist in the user model.");
      user = updateSnippetUserModel(
        email,
        snippetKey,
        userModelTagArray,
        userModelSummary,
        user
      );
    } else {
      console.log("Case: Snippet doesn't exist in the user model.");

      user.snippetArray.push(snippetData);
    }

    await updateUser(user);
    
    callback(null, {
      statusCode: 201,
      body: JSON.stringify({
        message: "Snippet processed successfully",
        snippetId: snippetKey,
        snippetData
      }),
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("An error occurred: ", error);
    errorResponse(
      "Main handler error.",
      context.awsRequestId,
      callback
    );
    return;
  }
};

// Working.
const updateSnippetUserModel = (
  email,
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
    const { Items } = await dynamoDB.scan(params).promise();
    // Returns snippetId if snippet exists, null otherwise.
    return Items["0"].snippetId || null;
  } catch (error) {
    console.error(`Error checking snippet existence: ${error.message}`);
    return null;
    // throw new Error('Error checking snippet existence');
  }
};


const snippetToObj = (snippetId, command, summary, tagArray) => {
  return {
    snippetId,
    command,
    summary,
    tagArray
};
}

// Working!
const updateUser = async (user) => {
  const params = {
    TableName: "User",
    Key: { email: user.email },
    UpdateExpression: "SET snippetArray = :sa",
    ExpressionAttributeValues: {
      ":sa": user.snippetArray.map((snippet) => snippetToObj({...snippet})),
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

