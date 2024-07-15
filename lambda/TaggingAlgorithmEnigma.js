/* 
                        TaggingAlgorithmEnigma.js

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

const randomBytes = require('crypto').randomBytes;
const AWS = require('aws-sdk');
const ddb = new AWS.DynamoDB.DocumentClient();
const {SnippetModel} = require('./SnippetModel')
const {UserModel} = require('./UserModel')



exports.handler = async (event, context, callback) => {
    if (!event.requestContext.authorizer) {
      errorResponse('Authorization not configured', context.awsRequestId, callback);
      return;
    }
    const snippetId = toUrlString(randomBytes(16));
    console.log('Received event (', snippetId, '): ', event);

    // Because we're using a Cognito User Pools authorizer, all of the claims
    // included in the authentication token are provided in the request context.
    // This includes the username as well as other attributes.
    const email = event.requestContext.authorizer.claims['cognito:email'];
    console.log('Current user: ', email);
    
    
    
    // The body field of the event in a proxy integration is a raw string.
    // In order to extract meaningful values, we need to first parse this string
    // into an object. A more robust implementation might inspect the Content-Type
    // header first and use a different parsing strategy based on that value.
    const requestBody = JSON.parse(event?.body);
    
    // TODO: LLM integration to generate values here.
    // TODO: Default values supplied by the user to be saved for insertion in the User Model.
    // TODO: Validation for the received command.
    const receivedCommand = requestBody?.command;
    const receivedSummary = requestBody?.summary || '';
    const receivedTagArray = requestBody?.tagArray?.split(',') || [];
    let generatedCommand, generatedSummary = ''
    let generatedTagArray = []
    
    // What if command already exist in the Snippet database?
    // If there will be any tag value or summary value sent along with command, those will be inserted in the user model along with command, if there already is a definition in the user model as well, then just override it with the latest received definition of summary, and append new tag values at the top of the array.

    

    // A snippet can only be inserted in the UserModel Database only after it has been inserted in the SnippetModel database.

    // Checks in snippet model.
    let tempKey = await checkIfSnippetExists(receivedCommand); // null || undefined if snippet exist, existing snippet key otherwise.

    if(!tempKey){
        // Snippet doesn't exist.
        // TODO: LLM call to generate below values will be made here.
        generatedCommand = '';
        generatedSummary = '';
        generatedTagArray = []

        await createSnippet(snippetId, generatedCommand, generatedSummary, generatedTagArray);
    } else{
        snippetId = tempKey;
    }

    // At this point. Snippet should exist regardless. We only have to worry about Snippet Model here.

    if(receivedSummary || receivedTagArray.length){
        
        // Check if user exist and if it doesn't then create one.
        const tempUserStore =  await checkIfUserExists(email); // null if it doesn't
        !tempUserStore ? await createUser(email) : undefined;
        
        //insertion in user model if either received summary or tag array in post request. If snippet exist override otherwise create new.
        
        const userModelSummary = receivedSummary || generatedSummary;
        const userModelTagArray = []; //TODO: append to the existing.
        const snippetData = new SnippetModel(snippetId, generatedCommand, userModelSummary, userModelTagArray);

        if(await checkIfSnippetExistsUser(email, snippetId)){
            // exist.
            await updateSnippetUserModel(email, snippetId, userModelTagArray, userModelSummary, tempUserStore);

        } else {
            // insert here.
            tempUserStore.snippetArray.push(snippetData)
            await updateUser(tempUserStore)
        }
    }    


    recordRide(rideId, username, unicorn).then(() => {
        // You can use the callback function to provide a return value from your Node.js
        // Lambda functions. The first parameter is used for failed invocations. The
        // second parameter specifies the result data of the invocation.

        // Because this Lambda function is called by an API Gateway proxy integration
        // the result object must use the following structure.
        callback(null, {
            statusCode: 201,
            body: JSON.stringify({
                RideId: rideId,
                Unicorn: unicorn,
                Eta: '30 seconds',
                Rider: username,
            }),
            headers: {
                'Access-Control-Allow-Origin': '*',
            },
        });
    }).catch((err) => {
        console.error(err);

        // If there is an error during processing, catch it and return
        // from the Lambda function successfully. Specify a 500 HTTP status
        // code and provide an error message in the body. This will provide a
        // more meaningful error response to the end client.
        errorResponse(err.message, context.awsRequestId, callback)
    });
};


const updateSnippetUserModel = async (email, snippetId, tagArray, summary, user) => {
    try {
        const snippetIndex = user.snippetArray.findIndex(snippet => snippet.snippetId === snippetId);
        
        // Append new tags in the existing tag array.
        user.snippetArray[snippetIndex].tagArray = [...new Set([...user.snippetArray[snippetIndex].tagArray, ...tagArray])]; 

        // Update the summary value.
        user.snippetArray[snippetIndex].summary = summary; 
        
        return await updateUser(user);

    } catch (error) {
        console.error('Error updating user:', error);
        throw error;
    }
}

const insertSnippetUserModel = async (user, snippet) => {
    try {
        user.snippetArray.push(snippet);
        return await updateUser(user)
    } catch (error) {
        console.error('Error updating user:', error);
        throw error;
    }
    
}
const checkIfSnippetExists = async (command) => {
    // Checks in Snippet model.
    const params = {
        TableName: 'SnippetTable',
        Key: { command }
    };
    try {
        const result = await dynamoDB.get(params).promise();
        return result?.Item?.snippetId // Returns true if snippet exists, null |undefined otherwise.
    } catch (error) {
        console.error(`Error checking snippet existence: ${error.message}`);
        throw new Error('Error checking snippet existence');
    }
};

const updateUser = async (user) => {
    const params = {
        TableName: 'UsersTable',
        Key: { email: user.email },
        UpdateExpression: 'SET snippetArray = :sa',
        ExpressionAttributeValues: {
            ':sa': user.snippetArray.map(snippet => snippet.toItem())
        }
    };
    try {
        return await dynamoDB.update(params).promise();
    } catch (error) {
        console.error(`Error updating user: ${error.message}`);
        throw new Error('Error updating user');
    }
}

const checkIfSnippetExistsUser = async (email, snippetId) => {
    const params = {
        TableName: 'UsersTable',
        Key: { email }
    };

    try {
        const result = await dynamoDB.get(params).promise();
        if (!result.Item) {
            throw new Error('User not found');
        }

        const user = new UserModel(result.Item.email, result.Item.snippetArray);
        return user.snippetArray.some(snippet => snippet.snippetId === snippetId);  // Returns true if a copy of snippet exist.
    } catch (error) {
        console.error(`Error checking snippetId for user: ${error.message}`);
        throw error;
    }
};

const checkIfUserExists = async (email) => {
    const params = {
        TableName: 'UsersTable',
        Key: { email }
    };

    try {
        const result = await dynamoDB.get(params).promise();
        return result.Item ? new UserModel(result.Item?.email, result.Item?.snippetArray) : null; // Returns user if user exists, false otherwise
    } catch (error) {
        console.error(`Error checking user existence: ${error.message}`);
        throw new Error('Error checking user existence');
    }
};

const createUser = async (email) => {
    try {
        const userModel = new UserModel(email);
        const params = {
            TableName: 'UsersTable',
            Item: userModel.toItem()
        };
        return await dynamoDB.put(params).promise();
        return {
            statusCode: 200,
            body: JSON.stringify('User created successfully')
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify(`Error creating user: ${error.message}`)
        };
    }
};

const createSnippet = async (snippetId, command, summary, tagArray) => {
    try {
        const dataModel = new SnippetModel(snippetId, command, summary, tagArray);
        const params = {
            TableName: 'SnippetTable',
            Item: dataModel.toItem()
        };

        return await dynamoDB.put(params).promise();
        // return {
        //     statusCode: 200,
        //     body: JSON.stringify('Item created successfully')
        // };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify(`Error creating item: ${error.message}`)
        };
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
      'Access-Control-Allow-Origin': '*',
    },
  });
}

