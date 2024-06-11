

export const handler = async (event, context) => {
    
    const {body} = event;
    console.log("EVENT: \n" + JSON.stringify(event, null, 2));
    
    return context.logStreamName;
  };
  