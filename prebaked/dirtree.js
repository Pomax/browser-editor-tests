const create = (tag) => document.createElement(tag);

export class DirTree {
  tree = {};

  constructor(files = [], valuator = (filename) => filename) {
    console.log(files);
    files.forEach((file) => this.addFile(file, valuator));
    this.sort(this.tree);
  }

  addFile(file, valuator) {
    const parts = file.split(`/`);
    let curr = this.tree;
    while (parts.length > 1) {
      const part = parts.shift();
      curr[part] ??= {};
      curr = curr[part];
    }
    curr[parts[0]] = valuator(file);
  }

  flat(tree = this.tree, list = [], prefix = ``) {
    console.log(tree);
    Object.entries(tree).forEach(([key, value]) => {
      if (typeof value === `object`) {
        return this.flat(value, list, prefix + (prefix ? `/` : ``) + key);
      }
      list.push(prefix + (prefix ? `/` : ``) + key);
    });
    return list;
  }

  sort(o) {
    Object.entries(o).forEach(([key, value]) => {
      if (typeof value === `object`) {
        o[key] = this.sort(value);
      } else {
        delete o[key];
        o[key] = value;
      }
    });
    return o;
  }

  addToPage(clickHandler, parent, tree = this.tree, prefix = ``) {
    Object.entries(tree).forEach(([key, value]) => {
      const isDir = typeof value === `object`;
      const item = create(`li`);
      item.textContent = key;
      item.classList.add(isDir ? `dir` : `file`);
      parent.appendChild(item);
      if (!isDir) {
        item.addEventListener(`click`, () =>
          clickHandler(prefix + (prefix ? `/` : ``) + key)
        );
      } else {
        const list = create(`ul`);
        parent.appendChild(list);
        this.addToPage(
          clickHandler,
          list,
          value,
          prefix + (prefix ? `/` : ``) + key
        );
      }
    });
  }
}
