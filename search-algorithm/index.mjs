/*
                    SearchAlgorithm.mjs

This algorithm will perform search operation on the User and Snippet table. 

Input: Can be any string. HTTP: Get request with string value. String will be formatted.

String requirement: String should end with space.
Valid string: "docker "
Invalid string: "docker"

Processing:
Possible cases: partial string, valid string & invalid string.
Step 1: Validate.
Step 2: Search the User table.
Step 3: Search the Snippet table. 
Step 4: Override values retrieved from Snippet table with values received from Snippet table.
Step 5: Send the response.

Output: JSON array object with snippet values.

Plan:
- I want most of the search functionality to be abstracted by DynamoDB, let me find some good methods that can do this for me.
*/

import AWS from "aws-sdk";
import { UserModel } from "./UserModel.mjs";
import Joi from "joi";

const dynamoDB = new AWS.DynamoDB.DocumentClient();
const validationSchema = Joi.array()
  .items(Joi.string().min(1))
  .min(1)
  .messages({
    "array.base": "Search terms should be an array of strings",
    "array.min": "At least one search term is required",
    "string.empty": "Search terms cannot be empty",
    "string.min": "Search terms cannot be empty",
  });

let responseMessage = "";

export const handler = async (event, context, callback) => {
  const email = event?.queryStringParameters?.userId;
  const searchTerm = event?.queryStringParameters?.searchTerm;

  if (!searchTerm) {
    errorResponse(
      400,
      "Missing search term query parameter",
      context.awsRequestId,
      callback
    );
    return;
  }

  console.log("Query parameters: ", searchTerm);

  // Format and process the search term.
  const searchTermArr = formatInput(searchTerm);
  const { error } = validationSchema.validate(searchTermArr);
  if (error) {
    console.error("Validation error: ", error);
    errorResponse("Invalid Values Received", context.awsRequestId, callback);
    return;
  }

  try {
    let user = await checkIfUserExists(email);

    let userTableResult = undefined;
    // User creation if user doesn't exist.
    if (user) {
      // Step 2: Search the User table. You will only do this when the user exist.
      let { snippetArray } = user;

      snippetArray = formatArrayResult(snippetArray);
      console.log("The snippet array is: ", snippetArray);
       userTableResult = snippetArray.filter((snippet) =>
        searchTermArr.some(
          (term) =>
            snippet.command.includes(term) ||
            snippet.summary.includes(term) ||
            snippet.tagArray.some((tag) => tag.includes(term))
        )
      );
    } else {
      responseMessage = responseMessage.concat(
        "User doesn't exist in the DB, creating user."
      );
      let userCreated = await createUser(email);
      !userCreated
        ? errorResponse(
            500,
            "internal server error",
            context.awsRequestId,
            callback
          )
        : undefined;
      responseMessage = responseMessage.concat("User created.");
      user = new UserModel(email, []);
    }
    console.log("Value retrieved from the user snippet database: ", userTableResult)

    // Step 3: Search the Snippet table.
    const snippetTableResult = await searchDatabase(searchTermArr);
    const searchResult = mergeObjectArrays(userTableResult, snippetTableResult);

  
    callback(null, {
      statusCode: 200,
      body: JSON.stringify({
        result: searchResult,
      }),
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("An error occurred: ", error);
    errorResponse(
      500,
      "Internal server main handler error.",
      context.awsRequestId,
      callback
    );
    return;
  }
};

const formatArrayResult = (inputArray) => {
  return inputArray.map(obj => obj.snippetId)
}

const searchDatabase = async (terms) => {
  const promises = terms.map((term) => {
    const params = {
      TableName: "Snippet",
      FilterExpression: "contains(tagArray, :term)",
      ExpressionAttributeValues: { ":term": term },
    };
    return dynamoDB.scan(params).promise();
  });

  const results = await Promise.allSettled(promises);
  const successfulResults = results
    .filter(result => result.status === "fulfilled")
    .map(result => result.value.Items);

  console.log("Successful results values", successfulResults)
  const allItems = successfulResults.flat();
  return allItems;
};

const mergeObjectArrays = (userTableResult, snippetTableResult) => {
  // Create a Map to hold objects by snippetId from userTableResult
  const resultMap = new Map();
  // Add all objects from userTableResult to the resultMap
  userTableResult.forEach((item) => {
    resultMap.set(item.snippetId, item);
  });
  // Add objects from snippetTableResult, but only if they are not in userTableResult
  snippetTableResult.forEach((item) => {
    if (!resultMap.has(item.snippetId)) {
      resultMap.set(item.snippetId, item);
    }
  });
  // Convert the resultMap values to an array and return it
  return Array.from(resultMap.values());
};

function formatInput(input) {
  const wordsArray = input.trim().split(/\s+/);
  return wordsArray;
}

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

function errorResponse(statusCode = 500, errorMessage, awsRequestId, callback) {
  callback(null, {
    statusCode,
    body: JSON.stringify({
      Error: errorMessage,
      Reference: awsRequestId,
    }),
    headers: {
      "Access-Control-Allow-Origin": "*",
    },
  });
}
