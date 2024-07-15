# Amazon Cognito:
- User Pool Name: EnigmaPool
- App Client Name: EnigmaIndexShell

- User Pool ID: us-east-1_5ccg9qB6q
- Client ID: n2jpn8d33o970d0ce1ibfuh0r

- trial user: dirghayujoshi48@gmail.com
- trial user password: aezak2@Wal


# Dynamo DB Table:
- Table Name: Snippet
- Partition Key: SnippetId
- Table ARN: arn:aws:dynamodb:us-east-1:637423319589:table/Snippet



# IAM Role:
- Role Name: TagSnippetLambda
- Policy Name (inline policy attached to the TagSnippetLambda role.): DynamoDBWriteAccess


# Lambda:
- Function Name: TaggingAlgorithmEnigma