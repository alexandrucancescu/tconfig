import {pathExistsSync, readFileSync} from "fs-extra";import {TAny, TArray, TBoolean, TNumber, TObject, TSchema, TString} from "./Types"import {join} from "path";import generate from "./TypeGenerator";import {writeFileSync} from "fs";const TO_REPLACE=`(${["TNumber","TBoolean","TString","TArray","TObject","TAny"].join("|")})`;const SEARCH_FOR_START=/(TConfig.create\()/;const OLD_TYPES_REGEX=/(type ConfigType=)/;function computeSchema(code:string):TSchema{	const context={TNumber,TBoolean,TString,TArray,TObject,TAny};	let result:TSchema;	code=`result=${code}`.replace(new RegExp(TO_REPLACE,"g"),"context.$1");	eval(code);	return result;}enum COMMAND{PRINT,INJECT}let fileContent;let filePath:string;let cmd:COMMAND;function parseCommand(){	const command=process.argv.slice(-2)[0];	if(command!=="print" && command!=="inject"){		console.error(`Invalid command '${command}'`);		process.exit(1);	}	cmd= command==="print" ? COMMAND.PRINT : COMMAND.INJECT;}function getFileFromArgs():string{	const fileArg=process.argv.slice(-1)[0];	let file;	if(!fileArg){		console.error("No file given as argument");		process.exit(1);	}	if(fileArg.substring(0,1)==="."){		file=join(process.cwd(),fileArg)	}else{		file=fileArg;	}	if(!pathExistsSync(file)){		console.error(`File ${file} does not exists`);		process.exit(1);	}	filePath=file;	return file;}function readFileContent(){	const file=getFileFromArgs();	try{		fileContent=readFileSync(file,"utf-8");		return fileContent;	}catch (e) {		console.error(`Could not read file: ${e}`);		process.exit(1);	}}function findBracesStartEnd(content:string):{start:number,end:number}{	let start;	let end;	let bracesOpen=0;	for(let i=0;i<content.length;i++){		const char=content.charAt(i);		if(char==="{"){			if(bracesOpen===0){				start=i;			}			bracesOpen++;		}else if(char==="}"){			bracesOpen--;			if(bracesOpen===0){				end=i;				break;			}		}	}	return {start,end};}function parseSchemaDeclaration():string{	const content=fileContent;	const index=content.search(new RegExp(SEARCH_FOR_START));	if(index<0){		console.error(`Could not find any sequence 'TConfig.create(' in file provided`);		process.exit(0);	}	const searchIn=content.substring(index+"TConfig.create(".length,content.length);	const {start,end}=findBracesStartEnd(searchIn);	if(typeof start!=="number"||typeof end!=="number"){		console.error("Could not find schema declaration");		process.exit(0);	}	return searchIn.substring(start, end + 1);}function indexOfOldTypes():{start:number,end:number}{	const content=fileContent;	const start=content.search(new RegExp(OLD_TYPES_REGEX));	if(start>=0){		let {end}=findBracesStartEnd(content.substring(start));		if(typeof end==="number"){			end=end+start+1;			return {start,end:end};		}	}	return null;}function replaceOldTypes(newTypes:string):string{	console.log("Trying to replace old types...");	const indexes=indexOfOldTypes();	if(!indexes){		return null;	}	// console.log(fileContent.substring(indexes.start,indexes.end));	const before=fileContent.substring(0,indexes.start);	const after=fileContent.substring(indexes.end+1);	return before+newTypes+after;}function injectUnderComment(newTypes:string):string{	console.log("Trying to inject under config comment...");	const parts=fileContent.split("//config_types");	if(parts.length<2) return null;	return `${parts[0]}//config_types\n${newTypes}${parts[1]}`;}function injectEnd(newTypes:string):string{	console.log("Injecting at end of file...");	return `${fileContent}\n${newTypes}`;}export default function inject(){	parseCommand();	readFileContent();	const schemaDeclaration=parseSchemaDeclaration();	const schema= computeSchema(schemaDeclaration);	const typeDeclarations=generate(schema,true);	if(cmd===COMMAND.INJECT){		let newContent=			replaceOldTypes(typeDeclarations)||			injectUnderComment(typeDeclarations)||			injectEnd(typeDeclarations);		writeFileSync(filePath,newContent);		console.log("DONE!");	}else if(cmd===COMMAND.PRINT){		console.log(`${"-".repeat(10)}\n${typeDeclarations}\n${"-".repeat(10)}`);	}}