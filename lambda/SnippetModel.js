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

module.exports ={SnippetModel};