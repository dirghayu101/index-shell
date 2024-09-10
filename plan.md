# Objective:
I am trying to make the index shell project more presentable. The idea is working alright my goal is to make it useful.

# Problems with the last deployed version:
- Database retrieval takes a lot of time. It should be quicker.
- More tags should be generated and they should be more intuitive.
- The frontend should have keyboard shortcuts to make it useful for programming.
- There is no CI/CD and lambda code had to be copy pasted in AWS console.
- No github action, no test no nothing.
- Resources weren't efficiently utilized, there might be a better option than dynamo DB table, code deploy, lambda, s3, etc.
- Even cognito, do we really need it? 


# Random ideas:
- Maybe we can have two algorithms, before tagging a simple algorithm will just add description to the snippet and format it for it to be immediately ready for retrieval and on the parallel another algorithm will just run asynchronously and tag the snippet.