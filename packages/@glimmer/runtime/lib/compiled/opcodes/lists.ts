import { Op } from '@glimmer/vm';
import {
  IterationArtifacts,
  Reference,
  ReferenceIterator,
  Tag
} from '@glimmer/reference';
import { APPEND_OPCODES } from '../../opcodes';
import { CheckPathReference } from './-debug-strip';
import { check, CheckString, expectStackChange, CheckInstanceof } from "@glimmer/debug";

class IterablePresenceReference implements Reference<boolean> {
  public tag: Tag;
  private artifacts: IterationArtifacts;

  constructor(artifacts: IterationArtifacts) {
    this.tag = artifacts.tag;
    this.artifacts = artifacts;
  }

  value(): boolean {
    return !this.artifacts.isEmpty();
  }
}

APPEND_OPCODES.add(Op.PutIterator, vm => {
  let stack = vm.stack;
  let listRef = check(stack.pop(), CheckPathReference);
  let key = check(stack.pop(), CheckPathReference);
  let iterable = vm.env.iterableFor(listRef, check(key.value(), CheckString));
  let iterator = new ReferenceIterator(iterable);

  stack.push(iterator);
  stack.push(new IterablePresenceReference(iterator.artifacts));
});

APPEND_OPCODES.add(Op.EnterList, (vm, { op1: relativeStart }) => {
  vm.enterList(relativeStart);
});

APPEND_OPCODES.add(Op.ExitList, vm => {
  vm.exitList();
});

APPEND_OPCODES.add(Op.Iterate, (vm, { op1: breaks }) => {
  let stack = vm.stack;
  let item = check(stack.peek(), CheckInstanceof(ReferenceIterator)).next();

  if (item) {
    let tryOpcode = vm.iterate(item.memo, item.value);
    vm.enterItem(item.key, tryOpcode);
  } else {
    vm.goto(breaks);
  }

  expectStackChange(vm.stack, item ? 2 : 0, 'Iterate');
});
