import * as T from "three";
export function box(parent, w, h, d, x, y, z, m) {
  let mesh = new T.Mesh(new T.BoxGeometry(w, h, d), m);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
