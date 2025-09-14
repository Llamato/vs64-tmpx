//
// Debug Info - TMPx
//

const path = require('path');
const fs = require('fs');

//-----------------------------------------------------------------------------------------------//
// Init module
//-----------------------------------------------------------------------------------------------//
// eslint-disable-next-line
BIND(module);

//-----------------------------------------------------------------------------------------------//
// Required Modules
//-----------------------------------------------------------------------------------------------//

const { Utils } = require('utilities/utils');
const { DebugSymbol, DebugAddressInfo, DebugLabel, DebugOpcodes } = require('debugger/debug_info_types');

//-----------------------------------------------------------------------------------------------//
// ACME Debug Report Parser
//-----------------------------------------------------------------------------------------------//

const ReportElementType = {
  UNKNOWN: 0,
  SYMBOL: 1,
  LABEL: 2,
  OPCODES: 3,
};

const ReportStatementType = {
    LABEL: 1,
    SYMBOL: 2,
    ADDRESS: 3,
    SCOPE_END: 4,
    MACRO_BEGIN: 5
};

class DebugInfoTmpx {
    static load(debug_info, project, filename) {
        let src = null;
        try {
            src = fs.readFileSync(filename, 'utf8');
        } catch (err) {
            if (err.code === 'ENOENT') {
                throw("label file " + filename + " does not exist");
            } else {
                throw("unable to read label file '" + filename + "'");
            }
        }

        let labelStatements = [];
        let baseDir = null;
        let source = null;
        let currentSourceRef = null;
        let insideMacro = false;


        const parser = new TmpxDebugParser();

        let lines = src.split("\n").filter(s => (s.trim().length > 0));
        for (let line of lines) {
            const statements = parser.parseLine(line);
            if(!statements) continue;

            for (const statement of statements) {
                if (!statement) continue;

                const statementType = statement.type;
                if(insideMacro) {
                    insideMacro = false;
                }
                continue;
            }
            switch (statementType) {
                case ReportStatementType.MACRO_BEGIN: {
                    insideMacro = true;
                    break;
                }
                case ReportStatementType.SOURCE: {
                    source = statement.path;
                    
                }
            }
        }
    }
}

class TmpxDebugParser {

}