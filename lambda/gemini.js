 const {
    GoogleGenerativeAI,
    HarmCategory,
    HarmBlockThreshold,
    
  } = require("@google/generative-ai");
  
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-pro",
    systemInstruction: "Input:\nThe input is going to be a bash command snippet of string type. You have to generate: formatted-command (string), tag-array (array of string) and summary (string). The command attribute can be any shell command. For example: docker run -dit --name web2 --network webServers nginx bash, kubectl expose deployment hello-node --type=LoadBalancer --port=8080, kubectl delete deployment hello-node, etc. \n\nOutput:\nThe output should be a json object with attributes: tag-array (array of string), formatted-command (string) and summary (string).\n\nRule: If the input command is some gibberish text (not a typo) it is up to you to judge if it gibberish, respond with a failure json response. \n\nThe tag-array attribute is an array of string data type. Array includes a list of tags related to the commands. For command: docker run -dit --name web2 --network webServers nginx bash; the tag array will be: [ 'docker', 'container', 'run-image', 'custom-network', 'network-definition' ]. The tag at the starting indices of the array are broad, and those towards the end are very specific. Take note of this, the output tag-array object that you will generate should be structured in a similar way from broad to more specific for the input command. This tag array is going to be used for searching, take that into consideration if you judge will make tags better. Try to make it as long as practical with all the related terms user might use to search for the associated commands. \n\nThe formatted-command will format the input command attribute and make it suitable for general use. Formatting includes removing sensitive information and replace static values with placeholders.  Example, if \"docker run -d -p 3306:3306 -e MYSQL_ROOT_PASSWORD=db_pass1234 --name mysqlDB --network dbNet mysql:latest\" is input then \"docker run -d -p 3306:3306 -e MYSQL_ROOT_PASSWORD=<in> --name <in> --network dbNet mysql:latest\"\n\nThe summary attribute should contain  information about the command. The information should be provided with the goal of practical use. Start with synopsis and describe as much as the user need to know to get comfortable with using that command, try to finish synopsis in one paragraph.  After this paragraph, give a more comprehensive description. It's up to you to judge how much description should fit the practical use need of the user. ",
  });
  
  const generationConfig = {
    temperature: 1,
    topP: 0.95,
    topK: 64,
    maxOutputTokens: 8192,
    responseMimeType: "application/json",
  };
  
  const safetySetting = [
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
      threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
    },
    {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
    },
    {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
    },
  ];

  async function GenerateSnippet(inputCommand) {
    const chatSession = model.startChat({
      generationConfig,
      safetySettings:safetySetting,
      history: [
        {
          role: "user",
          parts: [
            {text: "ls -la"},
          ],
        },
        {
          role: "model",
          parts: [
            {text: "{\"tag-array\": [\"ls\", \"list\", \"files\", \"directories\", \"file-system\", \"long-listing\", \"hidden-files\", \"details\"], \"formatted-command\": \"ls -la\", \"summary\": \"This command lists all files and directories (including hidden ones) in the current directory with detailed information like permissions, ownership, size, and modification time. \\n\\nThe `ls` command is a fundamental tool for navigating and inspecting file systems in Unix-like environments. The `-l` option provides a detailed listing format, while `-a` ensures that hidden files and directories are included in the output.\\n\\n**Options:**\\n* `-l`: Use a long listing format that includes details such as permissions, size, owner, and modification time.\\n* `-a`, `--all`:  Do not ignore entries starting with `.`\\n\\n**Output Columns (Long Format):**\\n* Permissions: File type and access rights (e.g., `drwxr-xr-x` for a directory).\\n* Hard links: Number of hard links to the file.\\n* Owner: Username of the file's owner.\\n* Group: Group name of the file's group.\\n* Size: File size in bytes.\\n* Modification Time: Last modification time of the file.\\n* File/Directory Name: Name of the file or directory.\"}\n"},
          ],
        },
        {
          role: "user",
          parts: [
            {text: "docker network create -d bridge --subnet 182.18.0.0/25 --gateway 182.18.0.1 dbNet"},
          ],
        },
        {
          role: "model",
          parts: [
            {text: "{\"tag-array\": [\"docker\", \"network\", \"create\", \"bridge\", \"subnet\", \"gateway\", \"docker-network\"], \"formatted-command\": \"docker network create -d bridge --subnet <subnet-cidr> --gateway <gateway-ip> <network-name>\", \"summary\": \"This command creates a Docker network in bridge mode with a specified subnet, gateway IP, and network name. This allows Docker containers to communicate with each other and with external networks. \\n\\nUse  '<subnet-cidr>'  to define the subnet for the network (e.g., 192.168.10.0/24), '<gateway-ip>' for the gateway IP address for the network, and '<network-name>' to specify the name for the new network.\"}\n\n"},
          ],
        },
        {
          role: "user",
          parts: [
            {text: "docker images --filter \"dangling=true\""},
          ],
        },
        {
          role: "model",
          parts: [
            {text: "{\"tag-array\": [\"docker\", \"image\", \"list\", \"filter\", \"dangling\", \"unused-images\"], \"formatted-command\": \"docker images --filter \\\"dangling=true\\\"\", \"summary\": \"This command lists Docker images that are classified as \\\"dangling.\\\" A dangling image is an image that is not associated with any running container and does not have any tags assigned to it. \\n\\nThese images often occupy unnecessary disk space. The command helps identify these images so you can remove them to free up resources.\"}\n\n"},
          ],
        },
        {
          role: "user",
          parts: [
            {text: "sudo usermod -a -G docker ec2-user"},
          ],
        },
        {
          role: "model",
          parts: [
            {text: "{\"tag-array\": [\"sudo\", \"usermod\", \"group\", \"docker\", \"permissions\", \"user-management\"], \"formatted-command\": \"sudo usermod -a -G <group-name> <username>\", \"summary\": \"This command adds a user to the 'docker' group. This grants the user access to Docker without needing sudo for every Docker command.  \\n\\nReplace '<group-name>' with the actual group name (e.g., docker) and '<username>' with the target username. After running this command, the specified user will be added to the specified group. You might need to log out and log back in for the changes to take effect.\"}\n\n"},
          ],
        },
        {
          role: "user",
          parts: [
            {text: "docker run -t --detach -p 80:80 containerofcats"},
          ],
        },
        {
          role: "model",
          parts: [
            {text: "{\"tag-array\": [\"docker\", \"run\", \"container\", \"detach\", \"port-mapping\", \"publish\", \"web-server\"], \"formatted-command\": \"docker run -t -d -p <host-port>:<container-port> <image-name>\", \"summary\": \"This command runs a Docker container in detached mode (background) and maps a port on the host machine to a port inside the container. \\n\\nUse `<host-port>` to specify the port on the host machine, `<container-port>` to specify the port inside the container (often the same as the application's listening port), and `<image-name>` to specify the Docker image to run. The `-t` option allocates a pseudo-terminal, often used with interactive applications, and the `-d` option runs the container in the background.\"}\n\n"},
          ],
        },
        {
          role: "user",
          parts: [
            {text: "ducker run -t --detach -p 80:80 containerofcats"},
          ],
        },
        {
          role: "model",
          parts: [
            {text: "{\"tag-array\": [\"command-error\"], \"formatted-command\": \"command-error\", \"summary\": \"Command not recognized. Please check for typos and ensure that all components (like 'docker') are spelled correctly.\"}\n\n"},
          ],
        },
        {
          role: "user",
          parts: [
            {text: "teraform apply"},
          ],
        },
        {
          role: "model",
          parts: [
            {text: "{\"tag-array\": [\"terraform\", \"iac\", \"infrastructure\", \"deploy\", \"provision\", \"cloud\"], \"formatted-command\": \"terraform apply\", \"summary\": \"This command is used to apply the changes required to reach the desired state of the configuration files in the current directory, which are generated after 'terraform plan'.\\n\\nBefore running 'terraform apply,' it is recommended to review the proposed changes by running 'terraform plan'. This allows you to verify that the planned actions align with your intentions.\\n\\nUpon execution, 'terraform apply' will create or modify infrastructure resources based on your Terraform code. It compares the current state of your infrastructure to the desired state defined in your configuration files and executes the necessary actions to achieve consistency. If any resources need to be created, modified, or destroyed, Terraform will perform those operations.\"}\n\n"},
          ],
        },
        {
          role: "user",
          parts: [
            {text: "docker run -d -p 3306:3306 -e MYSQL_ROOT_PASSWORD=db_pass1234 --name mysqlDB --network dbNet mysql:latest"},
          ],
        },
        {
          role: "model",
          parts: [
            {text: "{\"tag-array\": [\"docker\", \"run\", \"mysql\", \"database\", \"container\", \"detach\", \"port-mapping\", \"environment-variables\", \"custom-network\", \"network-definition\"], \"formatted-command\": \"docker run -d -p 3306:3306 -e MYSQL_ROOT_PASSWORD=<password> --name <container-name> --network <network-name> mysql:latest\", \"summary\": \"This command runs a MySQL database server in a Docker container with specific configurations:\\n\\n- **Detached mode (-d):** Runs the container in the background.\\n- **Port mapping (-p 3306:3306):** Maps port 3306 on the host machine to port 3306 inside the container, allowing access to the MySQL server.\\n- **Environment variable (-e MYSQL_ROOT_PASSWORD=<password>):** Sets the root password for the MySQL server. Replace `<password>` with a secure password.\\n- **Container name (--name <container-name>):** Assigns the name 'mysqlDB' to the container. Choose a descriptive name for your container.\\n- **Network (--network <network-name>):** Connects the container to the network specified by `<network-name>`, allowing communication with other containers on the same network.\\n- **Image (mysql:latest):** Uses the official MySQL Docker image with the 'latest' tag.\"}\n\n"},
          ],
        },
      ],
    });
  
    const result = await chatSession.sendMessage(inputCommand);
    const retrievedResult = result.response.text();
    return retrievedResult;

  }
  
module.exports = {GenerateSnippet}