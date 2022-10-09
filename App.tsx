import { StatusBar } from 'expo-status-bar';
import {Button, Linking, StyleSheet, Text, TextInput, View, Image, Pressable} from 'react-native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {NavigationContainer} from "@react-navigation/native";
import * as SecureStore from 'expo-secure-store';
import Ionicons from '@expo/vector-icons/Ionicons';
import DropDownPicker from 'react-native-dropdown-picker';
import { makeRedirectUri, useAuthRequest } from 'expo-auth-session';
import punycode from 'punycode/';
import Toast from 'react-native-toast-message';
import EmojiPicker, {emojiFromUtf16} from "rn-emoji-picker"
import React, {useEffect} from "react";
import AsyncStorage from '@react-native-async-storage/async-storage';
import emojis from './emojiData';
import themes from './themes';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import {Touchable} from "react-native-toast-message/lib/src/components/Touchable";

const Tab = createBottomTabNavigator();
const MainContext = React.createContext(undefined);


// Omg OAuth config
const discovery = {
	authorizationEndpoint: 'https://home.omg.lol/oauth/authorize',
	tokenEndpoint: 'https://api.omg.lol/oauth/token',
	revocationEndpoint: undefined,
};

/**
 * Saves the token to the secure store
 * @param value {string} The token to save
 * @returns {void}
 */
async function saveAPIkey(value : string) {
	await SecureStore.setItemAsync("omgalol_apikey", JSON.stringify(value));
}

/**
 * Gets the token from the secure store
 * @returns {Promise<string>}
 */
async function loadAPIkey() {
	return JSON.parse(await SecureStore.getItemAsync("omgalol_apikey"));
}

/**
 * Saves the theme
 * @param value {string} The theme
 * @returns {void}
 */
async function saveTheme(value : string) {
	await AsyncStorage.setItem('statuslog_theme', value);
}

/**
 * Load theme from storage
 * @returns {Promise<string>}
 */
async function loadTheme() {
	return await AsyncStorage.getItem('statuslog_theme');
}

/**
 * Loads a list of the users addresses from the OMG.LOL API
 * thank you adam for the special endpoint to allow this <3
 * @param setAddresses setAddresses function
 * @param getKey API key
 * @returns {void}
 */
function updateAddressList(setAddresses, getKey) {
	fetch('https://api.omg.lol/account/application/addresses', {
		headers: {
			"Authorization": `Bearer ${getKey}`
		}
	}).then(res => res.json()).then(res => {
		if(res.request.status_code === 200) {
			let addresses = [];
			res.response.forEach(addr => {
				addresses.push({
					label: punycode.toUnicode(addr.address),
					value: addr.address
				})
			})
			setAddresses(addresses);
		} else {
			return Toast.show({
				type: "error",
				text1: `Error updating address list. Error code: ${res.request.status_code}`,
				text2: `API key likely invalid ${res.request.status_code === 400 ? "(or maybe not.. Did you do something silly?)" : ""}, please sign out and sign back in :)`
			})
		}
	})
}

/**
 * Displays the currently selected emoji
 * @param props
 * @constructor
 */
const EmojiSelector = (props : { emojiObj: any, theme : any }) => {
	return (
		<View style={{width: 96, height: 96, justifyContent: "center", marginBottom: 15}}>
			<Image source={{uri: props.emojiObj.img && props.emojiObj.img}} style={{width: 96, height: 96, alignSelf: "center"}}></Image>
		</View>
	)
}

const HomeScreen = () => {
	// Wall of state
	let [getKey, setKey, getAddresses, setAddresses, theme, setTheme] = React.useContext(MainContext); // API key, address list
	let [status, setStatus] = React.useState(undefined); // Current text for the status
	let [address, setAddress] = React.useState(null); // Currently selected address
	let [loading, setLoading] = React.useState(false); // Is a status POST in progress? (to prevent clicking twice)
	let [lastAddrUpdate, updateAddr] = React.useState(0); // When was the last time the address list was updated?
	let [emoji, setEmoji] = React.useState("🫥"); // Currently selected emoji
	let [open, setOpen] = React.useState(false); // Is the address dropdown open?
	let [renderUI, setRenderUI] = React.useState(true); // Should the status UI be rendered, or are we in the emoji picker?
	const [recent, setRecent] = React.useState([]); // Recent emojis
	const [emojiObj, setEmojiObj] = React.useState({img: "https://static.omg.lol/type/fluentui-emoji-main/assets/Dotted line face/3D/dotted_line_face_3d.png"}); // OMG.LOL emoji data

	/**
	 * Posts a status update to the Statuslog API.
	 * Uses status and emoji from state.
	 */
	const postStatus = () => {
		setLoading(true)
		fetch(`https://api.omg.lol/address/${address}/statuses/`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"Authorization": `Bearer ${getKey}`
			},
			body: JSON.stringify({
				"content": status,
				"emoji": emoji
			})
		}).then(res => res.json()).then(res => {
			if (res.request.status_code === 200) {
				Toast.show({
					type: "success",
					text1: "Status posted!",
					text2: "Your status has been posted successfully. Click to view!",
					onPress: () => {
						Linking.openURL(res.response.url)
					}
				})
				return setLoading(false);
			} else {
				return Toast.show({
					type: "error",
					text1: `Error updating status. Error code: ${res.request.status_code}`,
					text2: "API key likely invalid, please sign out and sign back in :)"
				})
			}
		})
	}

	/**
	 * Fetches the user's addresses
	 * Max. 1/min
	 */
	useEffect(() => {
		if(lastAddrUpdate < Date.now() - 1000 * 60) {
			updateAddressList(setAddresses, getKey);
			updateAddr(Date.now());
		}
	}, [updateAddr, setAddresses, getKey, lastAddrUpdate, updateAddressList])

	// Render!
	return (
		<View style={styles.parentContainer}>
			<LinearGradient colors={theme.accent0} style={{width: "100%", height: 3}} start={{x: 0, y: 0}} end={{x: 1, y: 0}}/>
			{renderUI && <View style={styles.container}>
				<Text style={{color: theme.accent2[0], fontWeight: "bold", marginBottom: 15}}>Statusing your lol</Text>
				<DropDownPicker
					containerStyle={{width: "75%", alignSelf: "center", marginBottom: 15}}
					open={open}
					value={address}
					items={getAddresses}
					setOpen={setOpen}
					setValue={setAddress}
					setItems={setAddresses}
					placeholder={"Select an address..."}
				/>
				<Pressable onPress={() => { setRenderUI(false) }}>
					<EmojiSelector emojiObj={emojiObj} theme={theme}></EmojiSelector>
				</Pressable>
				<TextInput placeholder={"Type your status here..."} value={status} placeholderTextColor={"#dee2e6"} style={{color: "#FFF", borderColor: "#FFF", borderWidth: 1, width: "100%", borderRadius: 5, marginBottom: 15, padding: 5}} onChangeText={(text) => { setStatus(text) }}></TextInput>
				<Button color={theme.accent1[0]} disabled={loading || !status || !address || status.length < 0} title={"Post!"} onPress={() => {postStatus()}}></Button>
			</View>}
			{!renderUI && <View style={styles.parentContainer}>
				<Touchable onPress={() => setRenderUI(true)} style={styles.parentContainer}>
					<EmojiSelector emojiObj={emojiObj} theme={theme}></EmojiSelector>
					<View style={styles.parentContainer}>
						<EmojiPicker
							emojis={emojis} // emojis data source see data/emojis
							recent={recent} // store of recently used emojis
							autoFocus={true} // autofocus search input
							loading={false} // spinner for if your emoji data or recent store is async
							darkMode={true} // to be or not to be, that is the question
							perLine={7} // # of emoji's per line
							onSelect={(emojiObject) => {
								fetch(`https://api.omg.lol/statuslog/emoji/${emojiObject.emoji}`).then(res => res.json()).then(res => {
									if (res.request.status_code === 200) {
										setEmoji(emojiObject.emoji);
										setEmojiObj(res.response);
										setRenderUI(true);
									} else {
										return Toast.show({
											type: "error",
											text1: `Error fetching emote. Error code: ${res.request.status_code}`,
											text2: "Please contact skelly@omg.lol via email, and include the emoji you were trying to select."
										})
									}
								})
							}}
							onChangeRecent={setRecent}
						/>
					</View>
				</Touchable>
			</View>}
			<StatusBar style="light" />
		</View>
	);
}

const SettingsScreen = () => {
	let [getKey, setKey, getAddresses, setAddresses, theme, setTheme] = React.useContext(MainContext);
	let [open, setOpen] = React.useState(false); // Is the address dropdown open?
	let [getThemes, setThemes] = React.useState([]); // List of themes
	let [themesLoaded, setThemesLoaded] = React.useState(false); // List of themes
	useEffect(() => {
		if(!themesLoaded) {
			let themeList = [];
			Object.keys(themes).forEach((theme, index) => {
				themeList.push({label: themes[theme].name, value: themes[theme]});
			})
			setThemes(themeList);
			setThemesLoaded(true);
		}
	}, [themesLoaded, setThemes, setThemesLoaded])

	return (
		<View style={styles.parentContainer}>
			<LinearGradient colors={theme.accent0} style={{width: "100%", height: 3, top: 0, position: "absolute"}} start={{x: 0, y: 0}} end={{x: 1, y: 0}}/>
			<Text style={{color: theme.accent2[0], fontWeight: "bold"}}>Theme (scroll):</Text>

			<DropDownPicker
				containerStyle={{width: "75%", alignSelf: "center", marginBottom: 15}}
				open={open}
				value={theme}
				items={getThemes}
				setOpen={setOpen}
				setValue={setTheme}
				setItems={setThemes}
				itemKey="label"
				onChangeValue={() => {
					saveTheme(theme.key);
				}}
				placeholder={"default theme"}
			/>
			<Button color={theme.accent1[0]} title={"Log out"} onPress={() => {setKey(undefined);saveAPIkey("")}} />
			<StatusBar style="light" />
		</View>
	);
}

const SigninScreen = () => {
	let [getKey, setKey, getAddresses, setAddresses, theme, setTheme] = React.useContext(MainContext);
	const [request, response, promptAsync] = useAuthRequest(
		{
			clientId: '154bb96b527b61aae33a56ca8965d1c3', // 'addea4ef423ef2cf51cefb4d824a3356',
			scopes: ['everything'],
			redirectUri: makeRedirectUri({ path: "oauthredirect"}), //makeRedirectUri({ path: "/callback"}),
		},
		discovery
	);

	useEffect(() => {
		if (response?.type === 'success') {
			const { code } = response.params;
			fetch("https://appauth.skelly.omg.lol/", { // /dev", {
				method: "POST",
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					"code": code,
				})
			}).then(res => res.text()).then(token => {
				saveAPIkey(token);
				setKey(token);
			})
		}
	}, [response]);

	return (
		<View style={styles.container}>
			<LinearGradient colors={theme.accent0} style={{width: "100%", height: 3, top: 0, position: "absolute"}} start={{x: 0, y: 0}} end={{x: 1, y: 0}}/>
			<Text style={{color: theme.accent2[0], fontWeight: "bold", marginBottom: 10}}>To post a status you must log in</Text>
				<LinearGradient colors={theme.accent3} style={{padding: 1, borderRadius: 3}} start={{x: 0, y: 0}} end={{x: 1, y: 0}}>
					<Button title={"Sign in with OMG.LOL"} onPress={() => {promptAsync()}} disabled={!request} color={theme.accent1[0]}/>
				</LinearGradient>
			<StatusBar style="light" />
		</View>
	);
}

export default function App() {
	let [theme, setTheme] = React.useState(themes.defaultTheme);
	let [getKey, setKey] = React.useState(undefined);
	let [getAddresses, setAddresses] = React.useState([
			{label: "Loading...",
				value: "home"
			}]);
	let [getLoaded, setLoaded] = React.useState(false);


	useEffect(() => {
		loadAPIkey().then((value: object | undefined) => {
			if (value) setKey(value);
			loadTheme().then((value: string | undefined) => {
				console.log(value);
				if (value) setTheme(themes[value]);
				if (!themes[value]) setTheme(themes.defaultTheme);
				setLoaded(true);
			});
		});
	}, [setKey, setLoaded])


	if (!getLoaded) return <View style={styles.container}><Text style={{color: theme.accent2[0], fontWeight: "bold"}}>Statusing your lo(l)ading screen...</Text></View>;

	// @ts-ignore
	return (
		<MainContext.Provider value={[getKey, setKey, getAddresses, setAddresses, theme, setTheme]}>
			<NavigationContainer>
				<Tab.Navigator screenOptions={{
					tabBarActiveTintColor: theme.activeColor,
					tabBarInactiveTintColor: theme.inactiveColor,
					tabBarStyle: {
						backgroundColor: bg_dark,
						borderTopWidth: 0
					},
					headerStyle: {
						backgroundColor: bg_dark,
						borderBottomWidth: 0
					},
					headerTitleStyle: {
						color: theme.accent0[0],
						fontWeight: "bold",
						fontSize: 18
					},
					headerTitle: (props : any ) => (
						<MaskedView
							maskElement={<Text style={props.style}>{props.children}</Text>}>
							<LinearGradient colors={theme.accent0} start={{x: 0, y: 0}} end={{x: 1, y: 0}}><Text style={[props.style, { opacity: 0 }]} >{props.children}</Text></LinearGradient>
						</MaskedView>
					)
				}}>
					{getKey !== undefined ? [(
							<Tab.Screen key={"0"} name="Post a status"
							            options={{
								            tabBarIcon: ({focused, color, size}) => (<MaskedView maskElement={<Ionicons name="chatbubble-outline" size={size} color={color}/>}><LinearGradient colors={theme.accent4} start={{x: 0.2, y: 0}} end={{x: 1, y: 0.5}}><Ionicons name="chatbubble-outline" size={size} style={{opacity: 0}} color={color}/></LinearGradient></MaskedView>)
							            }}
							            component={HomeScreen}
							/>
					),(
							<Tab.Screen key={"1"} name="Settings"
							            options={{
								            tabBarIcon: ({focused, color, size}) => (<MaskedView maskElement={<Ionicons name="cog-outline" size={size} color={color}/>}><LinearGradient colors={theme.accent4} start={{x: 0.2, y: 0}} end={{x: 1, y: 0.5}}><Ionicons name="cog-outline" size={size} style={{opacity: 0}} color={color}/></LinearGradient></MaskedView>)
							            }}
							            component={SettingsScreen}
							/>
					)] : (
						<Tab.Screen name="Sign in"
						            options={{
							            tabBarIcon: ({focused, color, size}) => (<MaskedView maskElement={<Ionicons name="key-outline" size={size} color={color}/>}><LinearGradient colors={theme.accent4} start={{x: 0.2, y: 0}} end={{x: 1, y: 0.5}}><Ionicons name="key-outline" size={size} style={{opacity: 0}} color={color}/></LinearGradient></MaskedView>)
						            }}
						            component={SigninScreen}
						/>
					)}
				</Tab.Navigator>
			</NavigationContainer>
			<Toast />
		</MainContext.Provider>
	);
}


let bg_dark : string = '#212529';
let bg : string = "#343a40";

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: bg,
		alignItems: 'center',
		justifyContent: 'center',
	},
	parentContainer: {
		width: "100%",
		flex: 1,
		backgroundColor: bg,
		alignItems: 'center',
		justifyContent: 'center'
	}
});