# Module includes:
- Open Search configuration for elastic search.
- Document DB implementation of designed classes.
- Lambda get request for search algorithm.

# Steps:
- Need endpoint to test, so lambda function first.
- I will consult LLM to see if the idea is the best or if there is a better alternative.
- I will need to see if I really need document DB or any other DBMS as I am already using open search.
- I will dry run it with console.
- Finally I will write the terraform code for the deployment.

# Notes for future integration.
- You will have to configure lambda request to let it pass through cognito for authentication and authorization.
- 