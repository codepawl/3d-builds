/** The sculpted silhouette supplies the cartoon style; soft lighting keeps it plush. */
export function cartoonizeSeal(seal) {
  for (const mesh of seal.group.children) {
    mesh.material.userData.softShading = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  }
}
