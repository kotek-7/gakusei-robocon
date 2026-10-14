import { simulate } from "./match";
self.onmessage = ({ data }) => {
  try {
    self.postMessage({
      result: simulate(data.config, data.red, data.blue, data.priority),
    });
  } catch (error) {
    self.postMessage({ error: String(error) });
  }
};
