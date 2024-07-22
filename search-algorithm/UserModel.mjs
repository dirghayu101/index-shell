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
            tagArray: this.tagArray
        };
    }

    static isValid(snippet) {
        const { snippetId, command, summary, tagArray } = snippet;
        let valid = typeof snippetId === 'string' &&
               typeof command === 'string' &&
               typeof summary === 'string' &&
               Array.isArray(tagArray) &&
               tagArray.every(tag => typeof tag === 'string');
               
              console.log("isValid meta: ", valid) 
        
        return valid;
    }
}

export class UserModel {
    constructor(email, snippetArray = []) {
        if (typeof email !== 'string') throw new Error('email must be a string');
        if (!Array.isArray(snippetArray) || !snippetArray.every(snippet => SnippetModel.isValid(snippet))) {
            throw new Error('snippetArray must be an array of valid Snippet objects');
        }

        this.email = email;
        this.snippetArray = snippetArray;
    }

    toItem() {
        return {
            email: this.email,
            snippetArray: this.snippetArray.map(snippet => snippet.toItem())
        };
    }
}
