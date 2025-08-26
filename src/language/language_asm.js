//
// Assembler Language
//

//-----------------------------------------------------------------------------------------------//
// Init module
//-----------------------------------------------------------------------------------------------//
// eslint-disable-next-line
BIND(module);

//-----------------------------------------------------------------------------------------------//
// Required Modules
//-----------------------------------------------------------------------------------------------//
const { Range, ParserBase, TokenType, Token, StatementType, Statement, ParserHelper, ParserIterator, CharCode } = require('language/language_base');

//-----------------------------------------------------------------------------------------------//
// ACME Grammar
//-----------------------------------------------------------------------------------------------//

const AsmGrammar = {
    acmePseudoOpcodes: [
        "fill", "fi", "align", "convtab", "ct", "text", "tx", "pet", "raw", "scr", "scrxor", "to",
        "source", "src","binary", "bin", "zone", "zn", "sl", "svl", "sal", "pdb", "if", "ifdef",
        "for", "do", "endoffile", "warn", "error", "serious", "macro", "set", "initmem", "pseudopc",
        "cpu", "al", "as", "rl", "rs", "cbm", "subzone", "sz", "realpc", "previouscontext", "byte",
        "by", "word", "wo"
    ],

    kickAssemblerDirectives: [
        "align", "assert", "asserterror", "break", "by", "byte", "const", "cpu", "define", "disk",
        "dw", "dword", "encoding", "enum", "error", "errorif", "eval", "file", "filemodify",
        "filenamespace", "fill", "fillword", "for", "function", "if", "import", "importonce",
        "label", "lohifill", "macro", "memblock", "modify", "namespace", "pc", "plugin", "print",
        "printnow", "pseudocommand", "pseudopc", "return", "segment", "segmentdef", "segmentout",
        "struct", "te", "text", "var", "while", "wo", "word", "zp"
    ],

    kickPreprocessorDirectives: [
        "define", "elif", "else", "endif", "if", "import", "importif", "importonce", "undef"
    ],

    tmpxPseudoOpcodes: [
        "byte", "text", "screen", "include", "binary", "macro", "endm", "block", "bend", "var", "word", "rta", "null",
        "shift", "repeat", "if", "ifne", "ifeq", "ifpl", "ifmi", "ifdef", "ifndef", "endif", "lbl", "goto",
        "segment", "offs", "pron", "proff", "hidemac", "showmac", ".eor", "end","bounce"
    ],

    fuzzySearch: function(query) {

        if (!query || query.length < 1) return null;

        const items = [];

        if (query.charCodeAt(0) == CharCode.Exclamation) {
            for (let item of AsmGrammar.acmePseudoOpcodes) {
                const token = "!" + item;
                if (token.startsWith(query)) {
                    items.push(token);
                }
            }
        } else if  (query.charCodeAt(0) == CharCode.Period) {
            //Not ideal because now both tmpx and kickass show suggestions they do not support. Gotta figure out what assembler we are using somehow.
            for (let item of new Set(AsmGrammar.kickAssemblerDirectives.concat(AsmGrammar.tmpxPseudoOpcodes))) {
                const token = "." + item;
                if (token.startsWith(query)) {
                    items.push(token);
                }
            }
        } else if  (query.charCodeAt(0) == CharCode.NumberSign) {
            for (let item of AsmGrammar.kickPreprocessorDirective) {
                const token = "#" + item;
                if (token.startsWith(query)) {
                    items.push(token);
                }
            }
        }

        if (items.length < 1) return null;

        return items;
    }

};

//-----------------------------------------------------------------------------------------------//
// Assembler Parser
//-----------------------------------------------------------------------------------------------//

class AsmParser extends ParserBase {
    constructor() {
        super();
    }

    parse(src, filename, options) {
        if (null == src || src.length < 1) return;
        super.parse(src, filename, options);

        const cancellationToken = options ? options.cancellationToken : null;
        const ast = this._ast;
        const len = src.length;
        const it = new ParserIterator(src);

        let isKickAss = this.isKickAss;
        let isAcme = this.isAcme;
        let isTmpx = this.isTmpx;
        let isLLVM = this.isLLVM;

        let tokensPerLineOfs = -1;
        let tokensPerLineCount = 0;

        while (!it.eof()) {

            if (cancellationToken && cancellationToken.isCancellationRequested) return;

            const c = it.peek();
            const c2 = (it.ofs+1 < len) ? src.charCodeAt(it.ofs+1) : 0;

            let tokens = [];

            if (c == CharCode.CarriageReturn || c == CharCode.LineFeed) { // line break

                const range = new Range(it.ofs, it.row, it.col);

                const c2 = (it.ofs+1 < len) ? src.charCodeAt(it.ofs+1) : 0;
                if (c == CharCode.CarriageReturn && c2 == CharCode.LineFeed) {
                    range.inc(); it.next(); // skip another char
                }
                it.nextline();

                tokens.push(new Token(TokenType.LineBreak, src, range));

            } else if (c == CharCode.Asterisk && c2 == CharCode.Equals) { // *=PC

                const range = new Range(it.ofs, it.row, it.col);

                while (it.ofs < len && src.charCodeAt(it.ofs) != CharCode.CarriageReturn && src.charCodeAt(it.ofs) != CharCode.LineFeed) {
                    range.inc(); it.next();
                }

                tokens.push(new Token(TokenType.Comment, src, range));

            } else if (c == CharCode.Semicolon || (c == CharCode.Slash && c2 == CharCode.Slash)) { // line comment

                const range = new Range(it.ofs, it.row, it.col);

                while (it.ofs < len && src.charCodeAt(it.ofs) != CharCode.CarriageReturn && src.charCodeAt(it.ofs) != CharCode.LineFeed) {
                    range.inc(); it.next();
                }

                tokens.push(new Token(TokenType.Comment, src, range));

            } else if (c == CharCode.NumberSign && (c2 == CharCode.LessThan || c2 == CharCode.GreaterThan)) { // #< or #>
                it.next(); // skip #< or #>
                it.next();
            } else if (c == CharCode.NumberSign && isKickAss) { // preprocessor or LLVM directive

                const range = new Range(it.ofs, it.row, it.col);

                while (it.ofs < len && src.charCodeAt(it.ofs) != CharCode.CarriageReturn && src.charCodeAt(it.ofs) != CharCode.LineFeed) {
                    range.inc(); it.next();
                }

                tokens.push(new Token(TokenType.Preprocessor, src, range));

            } else if (c == CharCode.Plus && c2 == CharCode.Plus && isAcme) { // ++ label
                it.next(); // skip ++
                it.next();
            } else if (
                (c == CharCode.Period && (isAcme || isTmpx)) ||
                (c == CharCode.Exclamation && isKickAss) ||
                c == CharCode.Underscore ||
                ParserHelper.isAlpha(c) ||
                (c == CharCode.Plus && ParserHelper.isSymbolChar(c2))) { // identifier

                let range = null;

                let isReference = false;
                let isKickReference = false;

                if (c == CharCode.Plus && ParserHelper.isSymbolChar(c2)) {
                    if (tokensPerLineCount == 0) {
                        // '+macro' expression
                        isReference = true;
                        const prefixRange = new Range(it.ofs, it.row, it.col);
                        prefixRange.inc(); it.next();
                        tokens.push(new Token(TokenType.Reference, src, prefixRange));
                    } else {
                        // just a '+' operator in front of identifier
                        it.next();
                    }
                } else if (isTmpx && c == CharCode.NumberSign && ParserHelper.isSymbolChar(c2)){
                    isReference = true;
                    const prefixRange = new Range(it.ofs, it.row, itcol);
                    prefixRange.inc(); it.next();
                    tokens.push(new Token(TokenType.Reference), src, prefixRange);
                } else if (isKickAss && c == CharCode.Exclamation && ParserHelper.isSymbolChar(c2)) {
                    if (tokensPerLineCount > 0) {
                        // !label reference
                        isReference = true;
                        isKickReference = true;
                        const prefixRange = new Range(it.ofs, it.row, it.col);
                        prefixRange.inc();
                        tokens.push(new Token(TokenType.Reference, src, prefixRange));
                    }
                }

                range = new Range(it.ofs, it.row, it.col);
                if (!isReference || isKickReference) {
                    range.inc(); it.next();
                }

                while (it.ofs < len && ParserHelper.isSymbolChar(src.charCodeAt(it.ofs))) {
                    range.inc(); it.next();
                }

                tokens.push(new Token(TokenType.Identifier, src, range));

            } else if (
                (c == CharCode.Exclamation && isAcme) ||
                (c == CharCode.Period && (isKickAss || isLLVM))
                (c == CharCode.Hashtag && isTmpx)) { // directive or macro

                const range = new Range(it.ofs, it.row, it.col);
                range.inc(); it.next();

                while (it.ofs < len && ParserHelper.isSymbolChar(src.charCodeAt(it.ofs))) {
                    range.inc(); it.next();
                }

                tokens.push(new Token(TokenType.Macro, src, range));

            } else if (c == CharCode.SingleQuote || c == CharCode.DoubleQuote) { // string
                const quoteChar = c;

                it.next(); // skip opening quote char

                const range = new Range(it.ofs, it.row, it.col);

                while (it.ofs < len && src.charCodeAt(it.ofs) != quoteChar) {
                    range.inc(); it.next();
                }

                if (it.ofs < len) {
                    it.next(); // skip closing quote char
                }

                tokens.push(new Token(TokenType.String, src, range));


            } else if (ParserHelper.isNumeric(src.charCodeAt(it.ofs))) {

                const range = new Range(it.ofs, it.row, it.col);
                range.inc(); it.next();

                while (it.ofs < len && ParserHelper.isNumeric(src.charCodeAt(it.ofs))) {
                    range.inc(); it.next();
                }

                tokens.push(new Token(TokenType.Number, src, range));

            } else if (c == CharCode.Dollar && ParserHelper.isNumericHex(c2)) {

                const range = new Range(it.ofs, it.row, it.col);
                range.inc(); it.next();

                while (it.ofs < len && ParserHelper.isNumericHex(src.charCodeAt(it.ofs))) {
                    range.inc(); it.next();
                }

                tokens.push(new Token(TokenType.Number, src, range));

            } else if (c == CharCode.Percent && ParserHelper.isNumericBin(c2)) {

                const range = new Range(it.ofs, it.row, it.col);
                range.inc(); it.next();

                while (it.ofs < len && ParserHelper.isNumericBin(src.charCodeAt(it.ofs))) {
                    range.inc(); it.next();
                }

                tokens.push(new Token(TokenType.Number, src, range));

            } else if (c == CharCode.Equals) {

                const range = new Range(it.ofs, it.row, it.col);
                range.inc(); it.next();
                tokens.push(new Token(TokenType.Operator, src, range));

            } else {
                it.next();
            }

            if (tokens.length > 0) {
                for (const token of tokens) {
                    ast.addToken(token);
                    if (tokensPerLineCount == 0) token.setFirstFlag();

                    if (token.type == TokenType.LineBreak || token.type == TokenType.Comment) {
                        if (tokensPerLineCount > 0) {
                            this.lexer(tokensPerLineOfs, tokensPerLineCount);
                            tokensPerLineOfs = -1;
                            tokensPerLineCount = 0;
                        }
                    } else {
                        if (tokensPerLineOfs == -1) tokensPerLineOfs = ast.tokens.length - 1;
                        tokensPerLineCount++;
                    }
                }
            }

        }

        if (tokensPerLineCount > 0) {
            this.lexer(tokensPerLineOfs, tokensPerLineCount);
        }

    }

    lexer(tokenOffset, tokenCount) {
        if (tokenCount < 1) return;

        const isKickAss = this.isKickAss;
        const isAcme = this.isAcme;
        const isLLVM = this.isLLVM;
        const isTmpx = this.isTmpx;

        const ofs = tokenOffset;
        const count = tokenCount;

        const ast = this._ast;
        const tokens = ast.tokens;
        if (!tokens || tokens.length < ofs + count) return;

        let statement = null;

        const token = tokens[ofs];
        const tokenType = token.type;

        if (tokenType == TokenType.Comment) {
            statement = new Statement(StatementType.Comment, null, tokens, ofs, 1);
        } else if (tokenType == TokenType.Identifier) {
            if (!token.isAssemblerOpcode()) { // ignore ASM

                const nextToken = tokens[ofs+1];
                if (count > 1 && nextToken.text == "=") {
                    statement = new Statement(StatementType.Definition, StatementType.ConstantDefinition, token, tokens, ofs, count);
                } else if (!isLLVM || count == 1) {
                    statement = new Statement(StatementType.Definition, StatementType.LabelDefinition, token, tokens, ofs, count);
                }
            }
        } else if (tokenType == TokenType.Macro && count > 1) {
            const macroCommand = token.text;
            const paramToken = tokens[ofs+1];

            if (isAcme) {
                if (macroCommand == "!macro" && paramToken.type == TokenType.Identifier) {
                    statement = new Statement(StatementType.Definition, StatementType.MacroDefinition, paramToken, tokens, ofs, count);
                } else if (macroCommand == "!set" && paramToken.type == TokenType.Identifier) {
                    statement = new Statement(StatementType.Definition, StatementType.ConstantDefinition, paramToken, tokens, ofs, count);
                } else if (macroCommand == "!addr" && paramToken.type == TokenType.Identifier) {
                    statement = new Statement(StatementType.Definition, StatementType.AddressDefinition, paramToken, tokens, ofs, count);
                } else if (macroCommand == "!src" && paramToken.type == TokenType.String) {
                    statement = new Statement(StatementType.Include, null, paramToken, tokens, ofs, count);
                }
            } else if (isKickAss) {
                if (macroCommand == ".macro" && paramToken.type == TokenType.Identifier) {
                    statement = new Statement(StatementType.Definition, StatementType.MacroDefinition, paramToken, tokens, ofs, count);
                } else if (macroCommand == ".const" && paramToken.type == TokenType.Identifier) {
                    statement = new Statement(StatementType.Definition, StatementType.ConstantDefinition, paramToken, tokens, ofs, count);
                }
            } else if (isLLVM) {
                if (macroCommand == ".macro" && paramToken.type == TokenType.Identifier) {
                    statement = new Statement(StatementType.Definition, StatementType.MacroDefinition, paramToken, tokens, ofs, count);
                }
            } else if (isTmpx) {
                if (macroCommand == ".macro" && paramToken == TokenType.Identifier){
                    statement = new Statement(StatementType.Definition, StatementType.MacroDefinition, paramToken, tokens, ofs, count);
                }else if (macroCommand == ".include" && paramToken == TokenType.String){
                    statement = new Statement(StatementType.Include, null, paramToken, token, ofs, count);
                }
            }

        }

        if (statement) {
            ast.addStatement(statement);
            if (statement.type == StatementType.Definition) {
                ast.addDefinition(statement);
            } else if (statement.type == StatementType.Include) {
                ast.addReference(statement);
            }
        }
    }


};

//-----------------------------------------------------------------------------------------------//
// Module Exports
//-----------------------------------------------------------------------------------------------//

module.exports = {
    AsmParser: AsmParser,
    AsmGrammar: AsmGrammar
}
