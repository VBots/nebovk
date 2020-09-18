import { VK, Keyboard, MessageContext, Context, GroupMemberContext, IMessageContextSendOptions, getRandomId, MessageEventContext } from 'vk-io';
import { StepScene, IContext as IContextScene, IStepContext } from '@vk-io/scenes';
import { cmdMenu, CMenu, ICustomContext as IContextCustom } from '@vbots/cmenu';

// import PrimaryKit, { ISession as ISession2 } from '../../VBots/primary-kit';
import PrimaryKit, { ISession as ISession2 } from '@vbots/primary-kit';
import User from './models/user';
import { MMenu } from './mmenu';

require('dotenv').config();

const adminToken = process.env.ADMIN_TOKEN;
const adminUserId = Number(process.env.ADMIN_ID);

interface ISession extends ISession2 {
    profile: User;
}
export type SessionInContext = { session: ISession };
export type IContext<T = Context> = T & IContextCustom & IContextScene & IStepContext & SessionInContext;
export type IMessageContext = IContext<MessageContext>;

const vk = new VK({
    token: process.env.TOKEN!,
    apiVersion: '5.124',
});

const menuGenerator = (
    context: MessageContext,
    menuID?: CMenu['cmd'] | null,
    { isOneTime = false, isInline = false } = {}
) => {
    menuID = menuID || context.session.menuState || cmdMenu(MMenu.MainMenu);

    const isMenu = (e: CMenu) => menuID == cmdMenu(e);

    if (menuID === cmdMenu(MMenu.None)) {
        return undefined;
    }

    if (menuID === cmdMenu(MMenu.Close)) {
        return Keyboard.keyboard([]).oneTime();
    }

    let menuArr = [];

    if (isMenu(MMenu.Start) || isMenu(MMenu.MainMenu)) {
        menuArr.push([
            Keyboard.textButton({
                label: 'О боте',
                payload: {
                    command: cmdMenu(MMenu.About),
                },
                color: Keyboard.SECONDARY_COLOR,
            }),
            Keyboard.textButton({
                label: 'Помощь',
                payload: {
                    command: cmdMenu(MMenu.Help),
                },
                color: Keyboard.SECONDARY_COLOR,
            }),
        ]);
    } else if (isMenu(MMenu.GoPromo) || isMenu(MMenu.Help)) {
        menuArr.push([
            Keyboard.textButton({
                label: `Указать код`,
                payload: {
                    command: cmdMenu(MMenu.GoPromo),
                },
                color: Keyboard.SECONDARY_COLOR,
            }),
        ]);
    } else if (isMenu(MMenu.About)) {
        menuArr.push([
            Keyboard.payButton({
                hash: {
                    action: 'pay-to-group',
                    // @ts-ignore
                    group_id: vk.updates.options.pollingGroupId,
                    amount: 1,
                    aid: 9,
                    data: 'hellow-premium',
                    description: 'Buy Premium',
                },
            }),
        ]);
    }

    menuArr.push([
        Keyboard.callbackButton({
            label: 'Callback me',
            color: Keyboard.PRIMARY_COLOR,
            payload: {
                command: cmdMenu(MMenu.CB_CallbackMe),
            },
        }),
        Keyboard.callbackButton({
            label: '✨++',
            color: Keyboard.POSITIVE_COLOR,
            payload: {
                command: cmdMenu(MMenu.CB_LikeZ),
            },
        }),
    ]);

    return Keyboard.keyboard(menuArr).inline(isInline).oneTime(isOneTime);
};

const callbackDefaultSession = async (context: MessageContext, next: Function) => {
    const { session } = context;

    if (!('likez' in session)) {
        session.likez = 0;
    }
};

/**
 * Request for approve user request for invite (v0.2)
 */
const approveRequest = async (userId: number) => {
    if (!adminToken) {
        return null;
    }

    const vk_x = new VK({ token: adminToken });

    return await vk_x.api.groups.approveRequest({
        // @ts-ignore
        group_id: vk.updates.options.pollingGroupId,
        user_id: userId,
    });
};

const checkMutualFriends = async (userId: number) => {
    if (!adminToken) {
        return null;
    }

    const vk_x = new VK({ token: adminToken });

    try {
        return await vk_x.api.friends.getMutual({
            target_uid: userId,
        });
    } catch (e) {
        return null;
    }
};

// Временная Блокировка смс из бесед
vk.updates.on('message', async (context, next) => {
    if (context.isChat && context.peerId !== 2e9 + 3) {
        return;
    }
    await next();
});

let lastMessageData: { id?: number; peerId?: number } = {};
vk.updates.on('message_new', async (context: MessageContext, next: Function) => {
    lastMessageData = { id: context.id || context.conversationMessageId, peerId: context.peerId };
    return next();
});

const primaryKit = new PrimaryKit(vk);
primaryKit.InitFull({
    storageName: 'nebovk',
    defaultMenu: MMenu.None,
    menuGenerator,
    callbackDefaultSession,
    sceneIntercept: {
        CancelSceneMenu: MMenu.Confirm_Cancel,
        ToMenu: MMenu.MainMenu,
    },
    MyProfiler: User,
});

// чекалка на вступление в группу уже в ней состоящих
vk.updates.on('message', async (context: MessageContext, next: Function) => {
    const { profile }: ISession = context.session;

    if (profile.hasCheckpoint('welcome')) {
        return next();
    }

    if (!profile.data.wasInGroup) {
        if (profile.reachCheckpoint('wasInGroup')) {
            const { senderId: userId } = profile;
            // @ts-ignore
            const { pollingGroupId: groupId } = vk.updates.options;

            //
            try {
                const member = await vk.api.groups.isMember({
                    group_id: groupId,
                    user_id: userId,
                });
                profile.data.wasInGroup = !!member;

                console.log(`isMember [${userId}]:`, !!member);

                if (!member) {
                    context.send(`Было бы хорошо, если бы ты вступил в [club${groupId}|это сообщество].`);
                }
            } catch (e) {
                console.log(`Error (checkUser group isMember) [${userId}]:`, e);
            }
        }
    }
    // Если вступил, но уведомления о пополнении кармы не было
    else if (profile.reachCheckpoint('joinInGroup_wellcome')) {
        context.send(`Вам должна была быть пополнена карма за участие в сообществе.`);
    }

    return next();
});

// Событие на вступление в сообщество
vk.updates.on('group_member', async (context: IContext<GroupMemberContext>) => {
    const { userId, isJoin, isLeave, isSelfLeave, joinType, session } = context;
    /*
        joinType: request / approved / join
    */

    const profile = session ? session.profile : false;

    context.send = (text: string | IMessageContextSendOptions, params?: IMessageContextSendOptions) => {
        return vk.api.messages.send({
            random_id: getRandomId(),
            peer_id: userId,
            ...(typeof text !== 'object'
                ? {
                      message: text,
                      ...params,
                  }
                : text),
        });
    };

    if (isJoin) {
        if (profile) {
            if (joinType == 'approved') {
                if (!profile.data.wasInGroup) {
                    profile.data.wasInGroup = true;

                    try {
                        const res = profile.tryGetPromo(7);
                        if (res && res.ACTION.cash) {
                            await context.send(
                                `Вы получили бонус за вступление в сообщество!\nКарма пополнилась на [${res.ACTION.cash}]🕉️ unit`
                            );
                        }
                    } catch (e) {
                        if (e.code != 901) {
                            console.log('Error (group_member): ', e.message);
                        }
                    }

                    try {
                        await context.send('Добро пожаловать в сообщество!');
                        profile.reachCheckpoint('joinInGroup_wellcome');
                    } catch (e) {
                        if (e.code != 901) {
                            console.error('Нет прав на отправку смс?..', e.message);
                        }
                    }
                }
            }
            else if (joinType == 'request') {
                const mutalFriends = await checkMutualFriends(userId);

                if (!mutalFriends || !mutalFriends.length) {
                    const keyboard = Keyboard.builder()
                        .inline(true)
                        .textButton({
                            label: `Принять`,
                            payload: {
                                command: cmdMenu(MMenu.AcceptJoinGroup),
                                command2: userId,
                            },
                            color: Keyboard.SECONDARY_COLOR,
                        });

                    await vk.api.messages.send({
                        random_id: getRandomId(),
                        peer_id: adminUserId,
                        message: `Новый запрос в группу без общих друзей [id${userId}|user]`,
                        keyboard,
                    });
                    return;
                }

                if (!profile.data.wasInGroup) {
                    try {
                        await approveRequest(userId);
                    } catch (e) {
                        console.error(e);
                    }
                }
            }
        } else {
            console.log('Смс не было, но подал заявку.');
        }
    } else if (isLeave && isSelfLeave) {
        if (profile) {
            try {
                await context.send(`😨 Мы стараемся значит, а ты покидаешь нас...\nОбидно вообще-то 😔`);
            } catch (e) {
                if (e.code != 901) {
                    console.log('Error (group_member): ', e.message);
                }
            }
        }

        if (adminUserId) {
            await vk.api.messages.send({
                random_id: getRandomId(),
                peer_id: adminUserId,
                message: `Этот [id${userId}|user] покинул сообщество 😔`,
            });
        }
    }
});

//
const { hearManager: hearMan, menuManager: menuMan, sceneManager: sceneMan, storage } = primaryKit.Kit;

// Activate Promo
sceneMan!.addScenes([
    new StepScene('gopromo', [
        async (context: IMessageContext) => {
            const { profile }: ISession = context.session;

            if (context.scene.step.firstTime || !context.text) {
                await context.sendCM(MMenu.Confirm_Cancel, {}, `Введите код`);
                return;
            }

            try {
                const promo = profile.tryGetPromo(context.text!);
                let subMsg = ``;
                if (promo.ACTION.cash) {
                    subMsg += `\nКарма пополнилась на [${promo.ACTION.cash}]🕉️ unit`;
                }
                if (promo.ACTION.storeElement) {
                    subMsg += `\nВам открылся новый элемент. Проверьте список`;
                }

                await context.sendCM(MMenu.MainMenu, {}, `Код активирован!${subMsg}`);
                await context.scene.leave();
            } catch (e) {
                await context.send(`⚡️: ${e.message}`);
            }
        },
    ]),
]);


menuMan!.hear(MMenu.Start, async (context: IMessageContext) => {
    context.sendCM(MMenu.MainMenu, {}, 'Main menu');
});

menuMan!.hear(MMenu.About, async (context: IMessageContext) => {
    context.sendCM(MMenu.About, {}, 'About me..');
});

menuMan!.hear(MMenu.CB_CallbackMe, (context: IMessageContext) => {
    context.send('Это работает с телефона');
});

menuMan!.onFallback(async (context) => {
    context.sendCM(MMenu.Start, {}, 'no menu');
});

menuMan!.hear(MMenu.Help, async (context: IMessageContext) => {
    context.send('Ahmm... Use start', {
        keyboard: menuGenerator(context, cmdMenu(MMenu.Close)),
        attachment: ['doc191039467_523329920'],
    });
});

menuMan!.hear(MMenu.ResetMe, async (context: IMessageContext) => {
    // @ts-ignore
    context.session = {};
    context.sendCM(MMenu.None, {}, 'Reset user.');
});

menuMan!.hear(MMenu.GoPromo, async (context: IMessageContext) => {
    context.scene.enter('gopromo');
});

menuMan!.hear(MMenu.AcceptJoinGroup, async (context: IMessageContext) => {
    const { subCmd } = context;

    if (!isNaN(subCmd)) {
        try {
            const res = await approveRequest(Number(subCmd));
            await context.send(`Result: ${res}`);
        } catch (error) {
            if (error.code === 15) {
                await context.send(`Этот юзер уже в группе`);
            } else {
                console.error(error);
                await context.send(`Error: ${error.message}`);
            }
        }
    }
});

hearMan!.hear(/^qq$/i, async (context: IMessageContext) => {
    let res = await context.sendCM(MMenu.Start, {}, 'HelloW');

    console.log(res);
});

hearMan!.hear(/^log$/i, async (context: IMessageContext) => {
    await context.send(JSON.stringify(context.session, null, 2));
});

hearMan!.hear(/^spin$/i, async (context: IMessageContext) => {
    try {
        if (!lastMessageData.id) {
            return
        }

        await vk.api.messages.send({
            random_id: getRandomId(),
            peer_id: context.peerId,
            message: 'PIn This'
        });

        await vk.api.messages.pin({
            peer_id: context.peerId,
            conversation_message_id: lastMessageData.id + 1,
        });
    } catch (error) {
        console.error(error);
    }
});

hearMan!.onFallback(async (context: MessageContext) => {
    // context.sendCM(MMenu.Start, {}, '?what');

    const { text } = context;
    const { profile }: ISession = context.session;

    if (!context.isChat && text) {
        if (profile.hasCheckpoint('welcome')) {
            await context.sendCM(
                MMenu.MainMenu,
                { isInline: true },
                `Тек... Для начала напиши Привет, а вот потом и поговорить можно (:`,
                false
            );
            return;
        }

        const RegExpActivator = /^(#?\s?)([0-9]{1,3})$/i;
        if (RegExpActivator.test(text)) {
            await context.sendCM(
                MMenu.MainMenu,
                {},
                `Если ты хотел активировать элемент, то надо было написать так:\n\n активировать ${
                    text.match(RegExpActivator)![2]
                }`
            );
        } else if (profile.maybeMeanCode(text)) {
            await context.sendCM(
                MMenu.GoPromo,
                { isInline: true },
                `Для ввода кода нужно включить режим ввода кода - код.`,
                false
            );
        } else {
            await context.sendCM(
                MMenu.MainMenu,
                { isInline: true },
                `Команда не распознана.\nМожно воспользоваться кнопкой Помощь`,
                false
            );
        }
    }
});

vk.updates.on('vk_pay_transaction', async (context) => {
	console.log('Pay', context);
});

vk.updates.on('message_event', async (context: IContext<MessageEventContext>) => {
    let result = null;

    switch (context.eventPayload.command) {
        case cmdMenu(MMenu.CB_CallbackMe): {
            result = await context.answer({
                type: 'show_snackbar',
                text: 'Qqq',
            });
            break;
        }

        case cmdMenu(MMenu.CB_LikeZ): {
            context.session.likez++;
            result = await context.answer({
                type: 'show_snackbar',
                text: `Вохох, спасибо! 😁 (${context.session.likez})`,
            });
            break;
        }

        default: {
            result = await context.answer({
                type: 'show_snackbar',
                text: '🤔 Zzh...',
            });
            break;
        }
    }
});

(async function Run() {
    await storage!.init();
    await vk.updates.start().catch(console.error);

    console.log('Started');
})();
