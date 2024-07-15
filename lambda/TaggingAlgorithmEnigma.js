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


- Dirghayu Joshi
*/

const randomBytes = require('crypto').randomBytes;
const AWS = require('aws-sdk');
const ddb = new AWS.DynamoDB.DocumentClient();

/*
const fleet = [
    {
        Name: 'Angel',
        Color: 'White',
        Gender: 'Female',
    },
    {
        Name: 'Gil',
        Color: 'White',
        Gender: 'Male',
    },
    {
        Name: 'Rocinante',
        Color: 'Yellow',
        Gender: 'Female',
    },
];
*/
class SnippetModel {
    constructor(snippetId, command, summary, tagArray) {
        if (typeof snippetId !== 'string') throw new Error('snippetId must be a string');
        if (typeof command !== 'string') throw new Error('command must be a string');
        if (typeof summary !== 'string') throw new Error('summary must be a string');
        if (!Array.isArray(tagArray) || !tagArray.every(tag => typeof tag === 'string')) {
            throw new Error('tagArray must be an array of strings');
        }

        this.snippetId = snippetId;
        this.command = command;
        this.summary = summary;
        this.tagArray = tagArray;
    }

    toItem() {
        return {
            snippetId: this.snippetId,
            command: this.command,
            summary: this.summary,
            'tag-array': this.tagArray
        };
    }
}

class UserModel {
    constructor(email, snippetArray){

    }
}


exports.handler = (event, context, callback) => {
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
    console.log('Current user: ', username);
    // The body field of the event in a proxy integration is a raw string.
    // In order to extract meaningful values, we need to first parse this string
    // into an object. A more robust implementation might inspect the Content-Type
    // header first and use a different parsing strategy based on that value.
    // Summary and Tag Array should be the components. 
    const requestBody = JSON.parse(event?.body);

    const pickupLocation = requestBody.PickupLocation;
    const command = requestBody?.command;
    const summary = requestBody?.summary;
    const tagArray = requestBody?.tagArray?.split(',') || [];

    const unicorn = findUnicorn(pickupLocation);

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

// This is where you would implement logic to find the optimal unicorn for
// this ride (possibly invoking another Lambda function as a microservice.)
// For simplicity, we'll just pick a unicorn at random.
function findUnicorn(pickupLocation) {
    console.log('Finding unicorn for ', pickupLocation.Latitude, ', ', pickupLocation.Longitude);
    return fleet[Math.floor(Math.random() * fleet.length)];
}

function recordRide(rideId, username, unicorn) {
    return ddb.put({
        TableName: 'Rides',
        Item: {
            RideId: rideId,
            User: username,
            Unicorn: unicorn,
            RequestTime: new Date().toISOString(),
        },
    }).promise();
}

function toUrlString(buffer) {
    return buffer.toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

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

const createItem = async (snippetId, command, summary, tagArray) => {
    try {
        const dataModel = new SnippetModel(snippetId, command, summary, tagArray);
        const params = {
            TableName: 'YourTableName',
            Item: dataModel.toItem()
        };

        await dynamoDB.put(params).promise();
        return {
            statusCode: 200,
            body: JSON.stringify('Item created successfully')
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify(`Error creating item: ${error.message}`)
        };
    }
};

const getItem = async (snippetId) => {
    const params = {
        TableName: 'YourTableName',
        Key: { snippetId }
    };

    try {
        const result = await dynamoDB.get(params).promise();
        return {
            statusCode: 200,
            body: JSON.stringify(result.Item)
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify(`Error getting item: ${error.message}`)
        };
    }
};

const updateItem = async (snippetId, command, summary, tagArray) => {
    const params = {
        TableName: 'YourTableName',
        Key: { snippetId },
        UpdateExpression: 'set #command = :command, #summary = :summary, #tags = :tags',
        ExpressionAttributeNames: {
            '#command': 'command',
            '#summary': 'summary',
            '#tags': 'tag-array'
        },
        ExpressionAttributeValues: {
            ':command': command,
            ':summary': summary,
            ':tags': tagArray
        },
        ReturnValues: 'UPDATED_NEW'
    };

    try {
        const result = await dynamoDB.update(params).promise();
        return {
            statusCode: 200,
            body: JSON.stringify(`Item updated successfully: ${JSON.stringify(result.Attributes)}`)
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify(`Error updating item: ${error.message}`)
        };
    }
};

const deleteItem = async (snippetId) => {
    const params = {
        TableName: 'YourTableName',
        Key: { snippetId }
    };

    try {
        await dynamoDB.delete(params).promise();
        return {
            statusCode: 200,
            body: JSON.stringify('Item deleted successfully')
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify(`Error deleting item: ${error.message}`)
        };
    }
};