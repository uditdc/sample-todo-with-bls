import { memory } from "@blockless/sdk"
import { json, ipfs } from "@blockless/sdk/assembly"
import { http } from "@blockless/sdk"
import { Client } from "@blockless/sdk/assembly/http"
import { buffer2string, string2buffer } from "@blockless/sdk/assembly/strings"

class Todo {
  text: string
  completed: boolean

  constructor(text: string, completed: boolean) {
    this.text = text
    this.completed = completed
  }

  // Reads the todo from IPFS
  read(): Todo | null {
    // Load data from 127.0.0.0:5001/ipfs/todo.json
    let buf = new Array<u8>(1024)
    let data = ipfs.ipfsFileRead("/todo.json", 0, buf)
    if (!data) {
      return null
    }

    // Convert buffer to string
    let jsonString = buffer2string(buf, buf.length)
    let jsonObject = <json.JSON.Obj>json.JSON.parse(jsonString)
    let kvs = jsonObject.valueOf()
    if (kvs === null) {
      return null
    }

    // Parse TODO object, return null if empty
    let text = kvs.get("text").toString()
    let completed = <boolean>kvs.has("completed")
    if (text === null || !completed) {
      return null
    }

    // Return TODO object
    return new Todo(text, completed)
  }

  // Writes the todo to IPFS
  write(): boolean {
    // Prepare JSON object to write
    let jsonObject = new json.JSON.Obj()
    jsonObject.set("text", this.text)
    jsonObject.set("completed", this.completed)

    // Convert JSON string to arraybuffer
    let jsonString = jsonObject.stringify()
    let data = string2buffer(jsonString)
    let arr = new Array<u8>(data.byteLength)
    let view = new DataView(data)
    for (let i = 0; i < data.byteLength; i++) {
      arr[i] = view.getUint8(i)
    }

    // Update TODO Object on IPFS
    return ipfs.ipfsFileWrite(new ipfs.FileWriteOptions("/todo.json"), arr)
  }

  // Sends an HTTP request to update the todo status on the server
  update(): boolean {
    let headers = new Map<string, string>()
    headers.set("Content-Type", "application/json")
    let options = new http.ClientOptions("http://example.com", headers)
    let client = new Client(options)
    let jsonObject = new json.JSON.Obj()
    jsonObject.set("text", this.text)
    jsonObject.set("completed", this.completed)
    let requestBody = jsonObject.stringify()
    let response = client.post('/update', requestBody)
    if (response.keys.length == 0) {
      return false
    }
    return true
  }
}

function main(): void {
  let todo = new Todo("Buy milk", false).read()
  if (todo === null) {
    console.log("Error reading todo from IPFS.")
    return
  }

  console.log(`Current todo: ${todo.text} (${todo.completed ? "completed" : "not completed"}`)
  console.log("Enter new status (completed/not completed):")

  // Read STDIN if available
  let stdin = new memory.Stdin().read().toJSON()
  if (!stdin) {
    console.log("Error reading from standard input.");
    return;
  }

  // Verify the stdin object has 'results' field
  let results = stdin.get("results");
  if (results === null) {
    console.log("Error reading from standard input.");
    return;
  } else {
    let status = results.toString();
    console.log("  --> " + status)

    // Parse the 'results' field and update TODO object
    if (status == "completed") {
      todo.completed = true
    } else if (status == "not completed") {
      todo.completed = false
    } else {
      console.log("Invalid status entered.")
      return
    }

    // Update TODO value on IPFS
    if (!todo.write()) {
      console.log("Error writing todo to IPFS.")
      return
    }

    // Update TODO value on server
    // if (!todo.update()) {
    //   console.log("Error updating todo on server.");
    //   return;
    // }

    console.log("Todo updated successfully.")
  }
}

main()