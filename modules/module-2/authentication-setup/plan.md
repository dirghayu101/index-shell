- After failing to implement search algorithm I have decided that I need something to test the search algorithm while creating it, thus I thought of working on Authentication first.
- Sub-components include: Lambda for processing signup and login, DB for storing user data, Cognito for performing authentication and API gateway for handling endpoints.

- Now last week I was trying to try out microservices on my own, but that was a bad lesson as I got struck in reading documentation and was unable to move on from that. You never feel ready, you have to start somewhere. I realized how much I didn't know about node and how much engineering goes in lambda. And also how much I didn't know, which was a depressing experience to be fair. 

- So I started this week with the philosophy of being more hands on, trying out some tutorial and modify stuff to make it fit our use case. I started following the official tutorial on getting started with documentDB, and there was an error in the tutorial. I got a dependency/version issue for the first time and instead of trying out some alternate ways I got struck figuring out how to fix it. I didn't realize when I got so obsessed with fixing it that hours passed by and it was already 4 PM. I was fixing it for 6 hours and I didn't even realize. I felt guilty came home and slept after having dinner.

- Let's see what our actionable are gonna be:
    1. I need to verify that plan, I don't even know if I need a database for Cognito, I just realized after finally figuring out the error that Cognito already has a user pool to work with. 
    2. Lesson learnt: before proceeding with a plan based on your assumption asked AI if the plan is even feasible or if there is an alternate easy approach. I have made this mistake several time, all engineers have faced the problem that you are facing in some way, you have to find their optimal solution sometime instead of doing things from scratch in a suboptimal way.
    3. Lesson learnt: document whatever you are doing so you can track stuff and see improvement points in the workflow (fucking 6 hour fixing a dependency error? why didn't you simply change the OS? why didn't you choose to simply not fix it and find a way around it?)

- Chat GPT analysis result:
