export const handler = async (event) => {
    const {rawQueryString} = event
    
    console.log("Query string: " + rawQueryString)
    const response = {
      statusCode: 200,
      body: JSON.stringify(event, null, 2),
    };
    return response;
  };
  