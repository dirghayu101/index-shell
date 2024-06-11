1. Initialized npm: npm init -y

2. I am planning to create a zip package to directly upload as lambda. index.handler will be the starting function.
I might have to use aws-sdk related packages. 
Reference idea: https://docs.aws.amazon.com/lambda/latest/dg/nodejs-package.html

3. A Lambda function always runs inside a VPC owned by the Lambda service. Lambda applies network access and security rules to this VPC and Lambda maintains and monitors the VPC automatically. If your Lambda function needs to access the resources in your account VPC, configure the function to access the VPC. Lambda provides managed resources named Hyperplane ENIs, which your Lambda function uses to connect from the Lambda VPC to an ENI (Elastic network interface) in your account VPC.

There's no additional charge for using a VPC or a Hyperplane ENI. There are charges for some VPC components, such as NAT gateways. 

I don't need to worry about Lambda's networking. I just have to create a connection between lambda and my resources.

Reference: https://docs.aws.amazon.com/lambda/latest/dg/foundation-networking.html

4. I will start configuring open search.